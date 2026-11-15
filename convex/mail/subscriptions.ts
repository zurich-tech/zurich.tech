import { subscriptionHistory } from "./history";
import { insertSubscription, updateSubscription } from "./contacts";
import { ConvexError, v } from "convex/values";
import { action, internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

import { requireMail } from "./provider";
import { scope } from "./consent";

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
            if (row) await updateSubscription(ctx, row._id, values);
            else
                await insertSubscription(ctx, {
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
    args: { token: v.string(), scope: v.optional(scope) },
    handler: async (ctx, args) => {
        // resolve the subscriber through their private unsubscribe token
        const row = await ctx.db
            .query("subscriptions")
            .withIndex("by_token", (range) => range.eq("token", args.token))
            .unique();
        if (!row) throw new ConvexError("Subscription not found.");
        if (row.status !== "suppressed") {
            const now = Date.now();
            const selected = args.scope ?? "all";
            const weekly =
                row.status === "subscribed" &&
                row.weekly !== false &&
                selected !== "weekly" &&
                selected !== "all";
            const announcements =
                row.status === "subscribed" &&
                row.announcements !== false &&
                selected !== "announcement" &&
                selected !== "all";
            const followUps =
                (row.followUps ?? row.status !== "unsubscribed") &&
                selected !== "followup" &&
                selected !== "all";

            // derive marketing status without restoring consent through an opt-out
            const values = {
                weekly,
                announcements,
                followUps,
                reminders:
                    args.scope === "all" || args.scope === "reminder" ? false : row.reminders,
                status:
                    weekly || announcements ? ("subscribed" as const) : ("unsubscribed" as const),
            };
            await updateSubscription(ctx, row._id, {
                ...values,
                history: subscriptionHistory(row, { ...row, ...values }, now, "unsubscribe"),
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
            reminder: subscription.status !== "suppressed" && subscription.reminders !== false,
            weekly: subscription.status === "subscribed" && subscription.weekly !== false,
            announcement:
                subscription.status === "subscribed" && subscription.announcements !== false,
            followup:
                subscription.status !== "suppressed" &&
                (subscription.followUps ?? subscription.status !== "unsubscribed"),
            isSubscribed:
                subscription.status === "subscribed" &&
                (subscription.weekly !== false || subscription.announcements !== false),
        };
    },
});
