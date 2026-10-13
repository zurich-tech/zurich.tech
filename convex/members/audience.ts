import { countries } from "./countries";
import { allLanguages, languages } from "./languages";
import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireAccount, requireAdmin } from "../auth/access";
import {
    demographics,
    demographicOptions,
    demographicLabels,
    validateDemographics,
    validateParticipation,
    validateMotivations,
    motivationOptions,
    surveyQuestion,
    answerQuestion,
} from "./demographics";
import { validateTopics } from "../topics/queries";

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
        };
    },
});

/** Save or skip one question without replacing unrelated answers or changing consent. */
export const answer = mutation({
    args: { question: surveyQuestion, values: v.optional(v.array(v.string())) },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
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
            await validateTopics(ctx, args.values, account.interests);
        }

        // persist progress atomically with the answer, including explicit skips
        await ctx.db.patch(account._id, {
            ...answers,
            surveyVisited: [...new Set([...(account.surveyVisited ?? []), args.question])],
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
    },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        validateDemographics(args.demographics);
        validateParticipation(args.participation);
        validateMotivations(args.motivations);
        await validateTopics(ctx, args.interests, account.interests);
        await ctx.db.patch(account._id, {
            demographics: args.demographics,
            interests: args.interests,
            participation: args.participation,
            motivations: args.motivations,
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
            v.object({ question: surveyQuestion, values: v.optional(v.array(v.string())) }),
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
            if (entry.values !== undefined)
                answers = answerQuestion(answers, entry.question, entry.values);
        }
        await validateTopics(ctx, answers.interests, account.interests);

        await ctx.db.patch(account._id, {
            ...answers,
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
    const answered = values.filter(
        (value) => value != null && (!Array.isArray(value) || value.length > 0),
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
        await requireAdmin(ctx);
        const accounts = (await ctx.db.query("accounts").collect()).filter(
            (account) => account.status === "active",
        );
        // retain the common choices and include additional languages only when reported
        const reportedLanguages = new Set([
            ...languages.map((language) => language.value),
            ...accounts.flatMap((account) => account.demographics?.languages ?? []),
        ]);
        const languageOptions = allLanguages.filter((language) =>
            reportedLanguages.has(language.value),
        );
        const background = (
            Object.keys(demographicLabels) as (keyof typeof demographicLabels)[]
        ).map((field) => ({
            field,
            label: demographicLabels[field],
            multiple: field === "roles" || field === "languages",
            ...summarise(
                accounts.map((account) => account.demographics?.[field]),
                field === "languages" ? languageOptions : demographicOptions[field],
            ),
        }));
        return [
            ...background,
            ...(["residence", "citizenships"] as const).map((field) => {
                // include every reported country without hundreds of empty rows
                const totals = summarise(
                    accounts.map((account) => account.demographics?.[field]),
                    countries,
                );
                return {
                    field,
                    label:
                        field === "residence"
                            ? "Where do you live?"
                            : "Which countries are you a citizen of?",
                    multiple: field === "citizenships",
                    ...totals,
                    groups: totals.groups.filter((group) => group.count > 0),
                };
            }),
            {
                field: "motivations",
                label: "What brings you here?",
                multiple: true,
                ...summarise(
                    accounts.map((account) => account.motivations),
                    motivationOptions,
                ),
            },
        ];
    },
});
