import { eligible as receivesFollowUp } from "./followup";
import { isTentative } from "../events/conditions";
import { v } from "convex/values";
import {
    internalAction,
    internalMutation,
    internalQuery,
    type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";

/** Require configured delivery before accepting an email-dependent action. */
export function requireMail() {
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
        throw new Error("We cannot send your email. Please contact the team.");
}

/** Queue a durable, idempotent email in the same transaction as its cause. */
export async function enqueue(
    ctx: MutationCtx,
    key: string,
    to: string,
    subject: string,
    text: string,
    subscriptionId?: Id<"subscriptions">,
    delay = 0,
    html?: string,
    context?: Pick<Doc<"deliveries">, "category" | "eventId" | "registrationId" | "startsAt">,
) {
    // reuse the durable message for repeated requests
    const existing = await ctx.db
        .query("deliveries")
        .withIndex("by_key", (range) => range.eq("key", key))
        .unique();
    if (existing) return existing._id;
    // store the message before scheduling delivery
    const id = await ctx.db.insert("deliveries", {
        key,
        to,
        subject,
        text,
        html,
        subscriptionId,
        ...context,
        status: "queued",
        attempts: 0,
        createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(delay, internal.mail.deliveries.deliver, { id });

    return id;
}

/** Read an email only while its recipient remains eligible. */
export const read = internalQuery({
    args: { id: v.id("deliveries") },
    handler: async (ctx, args) => {
        // load the durable delivery before checking its state
        const delivery = await ctx.db.get(args.id);
        if (!delivery || delivery.status === "sent") return null;
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", delivery.to))
            .unique();
        if (subscription?.status === "suppressed") return null;
        if (delivery.subscriptionId) {
            if (
                !subscription ||
                subscription._id !== delivery.subscriptionId ||
                subscription.status !== "subscribed"
            )
                return null;
            if (delivery.category === "weekly" && subscription.weekly === false) return null;
            if (delivery.category === "announcement" && subscription.announcements === false)
                return null;
        }
        if (delivery.eventId) {
            const event = await ctx.db.get(delivery.eventId);
            if (!event) return null;
            if (delivery.category === "followup") {
                const registration = delivery.registrationId
                    ? await ctx.db.get(delivery.registrationId)
                    : null;
                if (!registration || !(await receivesFollowUp(ctx, event, registration)))
                    return null;
                return delivery;
            }
            if (delivery.category === "cancelled") {
                if (event.status !== "cancelled") return null;
            } else if (
                event.status !== "scheduled" ||
                (delivery.category !== "confirmed" && event.startsAt <= Date.now())
            )
                return null;
            if (delivery.category === "confirmed" && isTentative(event)) return null;
            if (
                (delivery.category === "confirmed" || delivery.category === "cancelled") &&
                delivery.registrationId
            ) {
                const row = await ctx.db.get(delivery.registrationId);
                if (!row || row.status === "cancelled" || row.status === "declined") return null;
            }
            if (delivery.category === "reminder") {
                const registration = delivery.registrationId
                    ? await ctx.db.get(delivery.registrationId)
                    : null;
                if (
                    isTentative(event) ||
                    subscription?.reminders === false ||
                    !registration ||
                    registration.status !== "going" ||
                    event.startsAt !== delivery.startsAt
                )
                    return null;
            }
        }

        return delivery;
    },
});

/** Record provider acceptance or retain the exact delivery failure. */
export const finish = internalMutation({
    args: {
        id: v.id("deliveries"),
        providerId: v.optional(v.string()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // load the durable delivery before checking its state
        const delivery = await ctx.db.get(args.id);
        if (!delivery) throw new Error("Delivery not found.");
        if (delivery.status === "sent") return;
        // retain provider acceptance or the exact failure
        const attempts = delivery.attempts + 1;
        await ctx.db.patch(args.id, {
            attempts,
            status: args.error ? "failed" : "sent",
            error: args.error,
            providerId: args.providerId,
        });

        // retry failed deliveries with exponential backoff
        if (args.error && attempts < 5)
            await ctx.scheduler.runAfter(60000 * 2 ** attempts, internal.mail.deliveries.deliver, {
                id: args.id,
            });
    },
});

/** Deliver one durable message through Resend with provider idempotency. */
export const deliver = internalAction({
    args: { id: v.id("deliveries") },
    handler: async (ctx, args) => {
        // skip messages already sent or no longer eligible
        const delivery = await ctx.runQuery(internal.mail.deliveries.read, args);
        if (!delivery) return;
        // send with provider idempotency and retain any delivery failure
        try {
            const result = await send({
                to: delivery.to,
                subject: delivery.subject,
                text: delivery.text,
                html: delivery.html,
                key: delivery.key,
            });
            await ctx.runMutation(internal.mail.deliveries.finish, {
                id: args.id,
                providerId: result.id,
            });
        } catch (error) {
            await ctx.runMutation(internal.mail.deliveries.finish, {
                id: args.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    },
});

/** Send transactional mail without retaining short-lived sign-in codes in the delivery queue. */
export async function send(message: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    key: string;
}) {
    requireMail();
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.key,
        },
        body: JSON.stringify({
            from: process.env.MAIL_FROM,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
        }),
    });
    // avoid logging response bodies that may contain message contents
    if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
    const result = (await response.json()) as { id: string };
    if (!result.id) throw new Error("Email provider returned no delivery identifier.");
    return result;
}
