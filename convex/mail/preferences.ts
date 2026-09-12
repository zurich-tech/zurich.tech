import { subscriptionHistory } from "./history";
import { v } from "convex/values";
import { action, internalAction, internalMutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAccount } from "../auth/access";
import { authComponent } from "../auth/component";
import { normalizeEmail } from "../members/emails";

/** Email choices shared by the settings form and its mutation. */
const preferences = {
    weekly: v.boolean(),
    announcements: v.boolean(),
    reminders: v.boolean(),
    followUps: v.boolean(),
};

/** Read private email preferences. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        await requireAccount(ctx);
        const user = await authComponent.getAuthUser(ctx);
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", normalizeEmail(user.email)))
            .unique();
        return {
            email: user.email,
            weekly: subscription?.status === "subscribed" && subscription.weekly !== false,
            announcements:
                subscription?.status === "subscribed" && subscription.announcements !== false,
            reminders: subscription?.reminders !== false,
            followUps: subscription?.followUps ?? subscription?.status !== "unsubscribed",
            isSuppressed: subscription?.status === "suppressed",
        };
    },
});

/** Generate a private unsubscribe token outside the database transaction. */
export const save = action({
    args: preferences,
    handler: async (ctx, args): Promise<void> => {
        await ctx.runMutation(internal.mail.preferences.update, {
            ...args,
            token: crypto.randomUUID() + crypto.randomUUID(),
        });
    },
});

/** Save preferences only for the verified address belonging to this session. */
export const update = internalMutation({
    args: { ...preferences, token: v.string() },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        const user = await authComponent.getAuthUser(ctx);
        if (!user.emailVerified)
            throw new Error("Verify your email before changing email preferences.");
        const email = normalizeEmail(user.email);
        const existing = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique();
        if (existing?.status === "suppressed")
            throw new Error("Email delivery is blocked for this address. Contact the team.");
        // preserve the existing unsubscribe token when preferences change
        const now = Date.now();
        const values = {
            email,
            memberId: account.memberId,
            weekly: args.weekly,
            announcements: args.announcements,
            reminders: args.reminders,
            followUps: args.followUps,
            status:
                args.weekly || args.announcements
                    ? ("subscribed" as const)
                    : ("unsubscribed" as const),
            token: existing?.token ?? args.token,
            verifiedAt: existing?.verifiedAt ?? now,
            updatedAt: now,
        };
        const history = subscriptionHistory(existing, values, now, "settings");
        if (existing) await ctx.db.patch(existing._id, { ...values, history });
        else
            await ctx.db.insert("subscriptions", {
                ...values,
                history,
                source: "account",
                createdAt: now,
            });
    },
});

/** Generate the unsubscribe token for a new account. */
export const enroll = internalAction({
    args: { email: v.string(), memberId: v.id("members") },
    handler: async (ctx, args) => {
        await ctx.runMutation(internal.mail.preferences.subscribe, {
            ...args,
            token: crypto.randomUUID() + crypto.randomUUID(),
        });
    },
});

/** Subscribe a new account without overriding an existing email choice. */
export const subscribe = internalMutation({
    args: { email: v.string(), memberId: v.id("members"), token: v.string() },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", args.email))
            .unique();
        if (existing) return;
        const now = Date.now();
        await ctx.db.insert("subscriptions", {
            ...args,
            status: "subscribed",
            history: subscriptionHistory(
                null,
                { status: "subscribed", weekly: true },
                now,
                "account",
            ),
            weekly: true,
            announcements: true,
            reminders: true,
            followUps: true,
            source: "account",
            verifiedAt: now,
            createdAt: now,
            updatedAt: now,
        });
    },
});
