import { countries } from "./countries";
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
        };
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
        const background = (
            Object.keys(demographicLabels) as (keyof typeof demographicLabels)[]
        ).map((field) => ({
            field,
            label: demographicLabels[field],
            multiple: field === "roles" || field === "languages",
            ...summarise(
                accounts.map((account) => account.demographics?.[field]),
                demographicOptions[field],
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
