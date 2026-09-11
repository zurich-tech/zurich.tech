import { v } from "convex/values";
import { action, mutation } from "../_generated/server";
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
        if (row.status !== "suppressed")
            await ctx.db.patch(row._id, { status: "unsubscribed", updatedAt: Date.now() });
    },
});
