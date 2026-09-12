import { subscriptionHistory } from "./history";
import { v } from "convex/values";
import { action, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

import { requireMail } from "./deliveries";

/** Send a subscription confirmation without subscribing an unverified address. */
export const subscribe = action({
    args: { email: v.string() },
    handler: async (ctx, args): Promise<void> => {
        requireMail();
        await ctx.runMutation(internal.mail.verification.prepare, {
            email: args.email,
            name: "",
            token: crypto.randomUUID() + crypto.randomUUID(),
            newsletterToken: crypto.randomUUID() + crypto.randomUUID(),
            purpose: "subscription",
        });
    },
});

/** Unsubscribe only the address owning this private token. */
export const unsubscribe = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        // resolve the subscriber through their private unsubscribe token
        const row = await ctx.db
            .query("subscriptions")
            .withIndex("by_token", (range) => range.eq("token", args.token))
            .unique();
        if (!row) throw new Error("Subscription not found.");
        if (row.status !== "suppressed") {
            const now = Date.now();
            await ctx.db.patch(row._id, {
                status: "unsubscribed",
                followUps: false,
                history: subscriptionHistory(
                    row,
                    { ...row, status: "unsubscribed" },
                    now,
                    "unsubscribe",
                ),
                updatedAt: now,
            });
        }
    },
});

/** Read subscription state through its private unsubscribe link. */
export const status = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!subscription) return null;
        return {
            isSubscribed:
                subscription.status === "subscribed" &&
                (subscription.weekly !== false || subscription.announcements !== false),
        };
    },
});
