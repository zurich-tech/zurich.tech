import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireAccount, requireAdmin } from "../auth/access";
import { demographics, demographicOptions } from "./demographics";

/** Read only the current account's private survey responses. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        const account = await requireAccount(ctx);
        return { demographics: account.demographics ?? {}, onboardedAt: account.onboardedAt };
    },
});

/** Save optional responses or remove them by leaving the fields blank. */
export const save = mutation({
    args: { demographics, isOnboarding: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        await ctx.db.patch(account._id, {
            demographics: args.demographics,
            onboardedAt: args.isOnboarding ? Date.now() : account.onboardedAt,
            updatedAt: Date.now(),
        });
    },
});

/** Dismiss the optional welcome step without changing survey responses. */
export const skip = mutation({
    args: {},
    handler: async (ctx) => {
        const account = await requireAccount(ctx);
        await ctx.db.patch(account._id, { onboardedAt: Date.now(), updatedAt: Date.now() });
    },
});

/** Return aggregate survey results to the team, hiding small response counts. */
export const summary = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const accounts = (await ctx.db.query("accounts").collect()).filter(
            (account) => account.status === "active",
        );
        const fields = ["age", "occupation", "education"] as const;

        return fields.map((field) => ({
            field,
            responses: accounts.filter((account) => account.demographics?.[field]).length,
            groups: demographicOptions[field].map((option) => {
                const count = accounts.filter(
                    (account) => account.demographics?.[field] === option.value,
                ).length;
                return { label: option.label, count: count >= 5 ? count : null };
            }),
        }));
    },
});
