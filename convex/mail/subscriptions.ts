import { subscriptionHistory } from "./history";
import { ConvexError, v } from "convex/values";
import { action, internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

import { requireMail } from "./provider";

/** Import reviewed delivery exclusions without changing consent or sending policy. */
export const suppress = internalMutation({
    args: { emails: v.array(v.string()), source: v.string(), isDryRun: v.boolean() },
    handler: async (ctx, args) => {
        // require a paused sender and a bounded, attributed import
        const policy = await ctx.db.query("mailPolicy").unique();
        if (!policy?.isPaused)
            throw new ConvexError("Pause bulk sending before importing exclusions.");
        if (!args.source.trim()) throw new ConvexError("Suppression source is required.");
        if (args.emails.length > 500)
            throw new ConvexError("Import at most 500 exclusions at once.");

        // normalize addresses and reject malformed input before any changes
        const emails = [...new Set(args.emails.map((email) => email.trim().toLowerCase()))];
        if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
            throw new ConvexError("Invalid exclusion address.");
        const now = Date.now();
        let changed = 0;

        // preserve existing suppression history and every unrelated preference
        for (const email of emails) {
            const row = await ctx.db
                .query("subscriptions")
                .withIndex("by_email", (q) => q.eq("email", email))
                .unique();
            if (row?.status === "suppressed") continue;
            changed++;
            if (args.isDryRun) continue;

            // record the exclusion without fabricating provider delivery events
            const values = {
                status: "suppressed" as const,
                updatedAt: now,
                history: subscriptionHistory(
                    row,
                    { status: "suppressed", weekly: row?.weekly },
                    now,
                    args.source,
                ),
            };
            if (row) await ctx.db.patch(row._id, values);
            else
                await ctx.db.insert("subscriptions", {
                    ...values,
                    email,
                    source: args.source,
                    createdAt: now,
                });
        }

        return { total: emails.length, changed, unchanged: emails.length - changed };
    },
});

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
        if (!row) throw new ConvexError("Subscription not found.");
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
