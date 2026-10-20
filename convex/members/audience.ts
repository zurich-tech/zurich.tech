import { countries } from "./countries";
import { cumulative, currentPoint } from "../statistics/history";
import { allLanguages, languages } from "./languages";
import { v } from "convex/values";
import { query, mutation, type QueryCtx } from "../_generated/server";
import { requireAccount, requireAdmin } from "../auth/access";
import {
    demographics,
    demographicOptions,
    demographicLabels,
    validateDemographics,
    validateParticipation,
    validateMotivations,
    motivationOptions,
    participationOptions,
    surveyQuestions,
    surveyLabels,
    surveyAnswer,
    surveyQuestion,
    type SurveyQuestion,
    answerQuestion,
} from "./demographics";
import { validateInterests } from "../topics/queries";
import { retiredInterests } from "./interests";
import type { Doc } from "../_generated/dataModel";
import { inferReviews, reviewInput, saveReviews } from "./reviews";

/** Read only the current account's private community answers. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        const account = await requireAccount(ctx);
        return {
            demographics: account.demographics ?? {},
            interests: account.interests ?? [],
            participation: account.participation ?? [],
            motivations: account.motivations ?? [],
            onboardedAt: account.onboardedAt,
            surveyVisited: account.surveyVisited ?? [],
            surveyCompletedAt: account.surveyCompletedAt,
            surveyReviews: account.surveyReviews ?? inferReviews(account),
        };
    },
});

/** Save or skip one question without replacing unrelated answers or changing consent. */
export const answer = mutation({
    args: {
        question: surveyQuestion,
        values: v.optional(v.array(v.string())),
        review: v.optional(reviewInput),
    },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        if (args.review && args.review.question !== args.question)
            throw new Error("review question does not match answer");
        const previous = {
            demographics: account.demographics ?? {},
            interests: account.interests ?? [],
            motivations: account.motivations ?? [],
            participation: account.participation ?? [],
        };
        const answers =
            args.values === undefined
                ? previous
                : answerQuestion(previous, args.question, args.values);
        if (args.question === "interests" && args.values !== undefined) {
            await validateInterests(ctx, args.values, account.interests);
        }

        // persist progress atomically with the answer, including explicit skips
        await ctx.db.patch(account._id, {
            ...answers,
            surveyVisited: [...new Set([...(account.surveyVisited ?? []), args.question])],
            surveyReviews: saveReviews(
                account.surveyReviews ?? inferReviews(account),
                args.review ? [args.review] : [],
                Date.now(),
            ),
            updatedAt: Date.now(),
        });
    },
});

/** Save explicit interests and optional answers without changing consent or permissions. */
export const save = mutation({
    args: {
        demographics,
        interests: v.array(v.string()),
        motivations: v.array(v.string()),
        participation: v.array(v.string()),
        isOnboarding: v.optional(v.boolean()),
        reviews: v.optional(v.array(reviewInput)),
    },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        validateDemographics(args.demographics);
        validateParticipation(args.participation);
        validateMotivations(args.motivations);
        await validateInterests(ctx, args.interests, account.interests);
        await ctx.db.patch(account._id, {
            demographics: args.demographics,
            interests: args.interests,
            participation: args.participation,
            motivations: args.motivations,
            surveyReviews: saveReviews(
                account.surveyReviews ?? inferReviews(account),
                args.reviews ?? [],
                Date.now(),
            ),
            onboardedAt: args.isOnboarding ? Date.now() : account.onboardedAt,
            updatedAt: Date.now(),
        });
    },
});

/** Dismiss onboarding without changing answers. */
export const skip = mutation({
    args: {},
    handler: async (ctx) => {
        const account = await requireAccount(ctx);
        await ctx.db.patch(account._id, { onboardedAt: Date.now(), updatedAt: Date.now() });
    },
});

/** Finish the optional survey, retaining unanswered questions and existing answers. */
export const finish = mutation({
    args: {},
    handler: async (ctx) => {
        const account = await requireAccount(ctx);
        const now = Date.now();
        await ctx.db.patch(account._id, {
            surveyCompletedAt: now,
            onboardedAt: account.onboardedAt ?? now,
            updatedAt: now,
        });
    },
});

/** Import an explicitly approved draft atomically, without overwriting skipped questions. */
export const saveDraft = mutation({
    args: {
        answers: v.array(
            v.object({
                question: surveyQuestion,
                values: v.optional(v.array(v.string())),
                review: v.optional(reviewInput),
            }),
        ),
    },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        let answers = {
            demographics: account.demographics ?? {},
            interests: account.interests ?? [],
            participation: account.participation ?? [],
            motivations: account.motivations ?? [],
        };
        for (const entry of args.answers) {
            if (entry.review && entry.review.question !== entry.question)
                throw new Error("review question does not match answer");
            if (entry.values !== undefined)
                answers = answerQuestion(answers, entry.question, entry.values);
        }
        await validateInterests(ctx, answers.interests, account.interests);

        await ctx.db.patch(account._id, {
            ...answers,
            surveyReviews: saveReviews(
                account.surveyReviews ?? inferReviews(account),
                args.answers.flatMap((entry) => (entry.review ? [entry.review] : [])),
                Date.now(),
            ),
            surveyVisited: [
                ...new Set([
                    ...(account.surveyVisited ?? []),
                    ...args.answers.map((entry) => entry.question),
                ]),
            ],
            updatedAt: Date.now(),
        });
    },
});

/** Aggregate exact response counts and percentages for administrators. */
export function summarise(
    values: (string | string[] | null | undefined)[],
    options: readonly { value: string; label: string }[],
) {
    // blank legacy values are not responses; explicit null remains a declined answer
    const answered = values.filter((value) =>
        Array.isArray(value) ? value.some((item) => item.trim().length > 0) : !!value?.trim(),
    );
    const responses = answered.length;
    const withheld = values.filter((value) => value === null).length;
    return {
        responses,
        total: values.length,
        withheld,
        groups: options.map((option) => {
            const count = answered.filter((value) =>
                Array.isArray(value) ? value.includes(option.value) : value === option.value,
            ).length;
            return {
                label: option.label,
                count,
                percentage: responses > 0 ? Math.round((count / responses) * 100) : 0,
            };
        }),
    };
}

/** Administrator-only, self-reported community statistics. */
export const summary = query({
    args: {},
    handler: async (ctx) => {
        const report = await audience(ctx);

        return report.questions;
    },
});

/** Read survey participation totals and every question's responses. */
export const report = query({
    args: {},
    handler: audience,
});

/** Aggregate private answers for active administrators. */
async function audience(ctx: QueryCtx) {
    await requireAdmin(ctx);
    const accounts = (await ctx.db.query("accounts").collect()).filter(
        (account) => account.status === "active",
    );

    return aggregateAudience(ctx, accounts);
}

/** Aggregate the accounts selected by an authorised caller. */
export async function aggregateAudience(ctx: QueryCtx, accounts: Doc<"accounts">[]) {
    const reviews = accounts.map((account) => {
        const saved = new Map(inferReviews(account).map((review) => [review.question, review]));
        for (const review of account.surveyReviews ?? []) saved.set(review.question, review);

        return [...saved.values()];
    });
    /** Apply each option's exposure denominator to the existing response counts. */
    function summariseQuestion(
        field: SurveyQuestion,
        options: readonly { value: string; label: string }[],
    ) {
        const raw = accounts.map((account) =>
            field === "interests" || field === "motivations" || field === "participation"
                ? account[field]
                : account.demographics?.[field],
        );
        const values = raw.map((value) =>
            (Array.isArray(value) ? value : value ? [value] : []).filter(
                (value) => value.trim().length > 0,
            ),
        );
        const summary = summarise(raw, options);

        return {
            ...summary,
            groups: summary.groups.map((group, index) => {
                let reviewed = 0;
                let inferred = 0;
                const option = options[index].value;
                for (let account = 0; account < accounts.length; account++) {
                    if (!values[account].length) continue;
                    const review = reviews[account].find((review) => review.question === field);
                    if (review?.source !== "explicit") inferred++;
                    if (review?.options.includes(option) || values[account].includes(option)) {
                        reviewed++;
                    }
                }

                return {
                    ...group,
                    reviewed,
                    inferred,
                    unreviewed: summary.responses - reviewed,
                    percentage: reviewed ? Math.round((group.count / reviewed) * 100) : 0,
                };
            }),
        };
    }
    // hide retired choices without changing stored answers or respondent totals
    const reportedInterests = new Set(
        accounts
            .flatMap((account) => account.interests ?? [])
            .filter((slug) => !Object.hasOwn(retiredInterests, slug)),
    );
    const topics = (await ctx.db.query("topics").collect())
        .filter(
            (topic) =>
                !Object.hasOwn(retiredInterests, topic.slug) &&
                (topic.isActive || reportedInterests.has(topic.slug)),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
    // retain reported subjects even when their catalogue entry has been removed
    const interestOptions = topics.map((topic) => ({
        value: topic.slug,
        label: topic.name,
    }));
    for (const slug of reportedInterests) {
        if (!interestOptions.some((option) => option.value === slug))
            interestOptions.push({ value: slug, label: slug });
    }
    // retain the common choices and include additional languages only when reported
    const reportedLanguages = new Set([
        ...languages.map((language) => language.value),
        ...accounts.flatMap((account) => account.demographics?.languages ?? []),
    ]);
    const languageOptions = allLanguages.filter((language) =>
        reportedLanguages.has(language.value),
    );
    const background = (Object.keys(demographicLabels) as (keyof typeof demographicLabels)[]).map(
        (field) => ({
            field,
            label: surveyLabels[field],
            multiple: field === "roles" || field === "languages" || field === "eventKinds",
            ...summariseQuestion(
                field,
                field === "languages" ? languageOptions : demographicOptions[field],
            ),
        }),
    );
    const questions = [
        {
            field: "interests",
            label: surveyLabels.interests,
            multiple: true,
            ...summariseQuestion("interests", interestOptions),
        },
        ...background,
        ...(["residence", "citizenships"] as const).map((field) => {
            // include every reported country without hundreds of empty rows
            const totals = summariseQuestion(field, countries);
            return {
                field,
                label: surveyLabels[field],
                multiple: field === "citizenships",
                ...totals,
            };
        }),
        {
            field: "participation",
            label: surveyLabels.participation,
            multiple: true,
            ...summariseQuestion("participation", participationOptions),
        },
        {
            field: "motivations",
            label: surveyLabels.motivations,
            multiple: true,
            ...summariseQuestion("motivations", motivationOptions),
        },
    ].sort(
        (a, b) =>
            surveyQuestions.indexOf(a.field as (typeof surveyQuestions)[number]) -
            surveyQuestions.indexOf(b.field as (typeof surveyQuestions)[number]),
    );

    // finishing is explicit and may include skips; full answers are counted independently
    const answeredCounts = accounts.map((account) => {
        const answers = {
            demographics: account.demographics ?? {},
            interests: account.interests ?? [],
            participation: account.participation ?? [],
            motivations: account.motivations ?? [],
        };

        return surveyQuestions.filter((question) =>
            surveyAnswer(answers, question).some((value) => value.trim().length > 0),
        ).length;
    });

    return {
        total: accounts.length,
        signupHistory: currentPoint(
            cumulative(accounts.map((account) => ({ at: account.createdAt, value: 1 }))),
            accounts.length,
            Date.now(),
        ),
        respondents: answeredCounts.filter((count) => count > 0).length,
        finished: accounts.filter((account) => account.surveyCompletedAt !== undefined).length,
        fullyAnswered: answeredCounts.filter((count) => count === surveyQuestions.length).length,
        questions,
    };
}
