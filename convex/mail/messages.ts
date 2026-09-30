import { isListed } from "../events/visibility";
import { send } from "./provider";
import { canSend } from "./access";
import { updateMessage } from "./progress";
import { reconcile } from "./webhooks";
import { isBulk, recipientAllowed } from "./policy";
import { reserve } from "./sending";
import { receivesFollowUp } from "./audiences";
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
    context?: Pick<
        Doc<"messages">,
        | "category"
        | "eventId"
        | "registrationId"
        | "startsAt"
        | "campaignId"
        | "expiresAt"
        | "unsubscribeToken"
        | "isTest"
    >,
) {
    // reuse the durable message for repeated requests
    const existing = await ctx.db
        .query("messages")
        .withIndex("by_key", (range) => range.eq("key", key))
        .unique();
    if (existing) return existing._id;
    // store the message before scheduling delivery
    const id = await ctx.db.insert("messages", {
        key,
        to,
        subject,
        text,
        html,
        subscriptionId,
        ...context,
        status: "queued",
        isBulk: isBulk(context?.category),
        nextAttemptAt: Date.now() + delay,
        attempts: 0,
        createdAt: Date.now(),
    });
    if (!isBulk(context?.category))
        await ctx.scheduler.runAfter(delay, internal.mail.messages.deliver, { id });

    return id;
}

/** Read an email only while its recipient remains eligible. */
export const read = internalQuery({
    args: { id: v.id("messages") },
    handler: async (ctx, args) => {
        // load the durable delivery before checking its state
        const delivery = await ctx.db.get(args.id);
        if (!delivery || delivery.status !== "queued") return null;
        if (delivery.campaignId && !delivery.isTest) {
            const campaign = await ctx.db.get(delivery.campaignId);
            if (!campaign || campaign.status === "cancelled") return null;
            // recheck new registrations and adverse reports after batch approval
            if (campaign.audience?.kind === "subscribers") {
                const audience = campaign.audience;
                const subscription = delivery.subscriptionId
                    ? await ctx.db.get(delivery.subscriptionId)
                    : null;
                if (audience.deliveredSince !== undefined && subscription?.hasDeliveryFailure)
                    return null;
                if (audience.excludeEventId) {
                    const registrations = await ctx.db
                        .query("registrations")
                        .withIndex("by_event", (q) => q.eq("eventId", audience.excludeEventId!))
                        .collect();
                    if (
                        registrations.some(
                            (row) =>
                                row.status !== "cancelled" &&
                                row.status !== "declined" &&
                                (row.email === delivery.to ||
                                    (subscription?.memberId &&
                                        row.memberId === subscription.memberId)),
                        )
                    )
                        return null;
                }
            }
            // Do not deliver a promotional snapshot after an included event becomes unlisted.
            for (const id of campaign.eventIds ?? []) {
                const event = await ctx.db.get(id);
                if (!event || !isListed(event)) return null;
            }
            if (campaign.audience?.kind === "registrations") {
                const row = delivery.registrationId
                    ? await ctx.db.get(delivery.registrationId)
                    : null;
                const status = campaign.audience.status;
                if (
                    !row ||
                    row.eventId !== campaign.audience.eventId ||
                    row.status === "cancelled" ||
                    row.status === "declined"
                )
                    return null;
                if ((status === "going" || status === "waitlist") && row.status !== status)
                    return null;
                if (
                    status === "attended" &&
                    !(await ctx.db
                        .query("attendances")
                        .withIndex("by_registrationId", (q) => q.eq("registrationId", row._id))
                        .unique())
                )
                    return null;
            }
        }
        if (delivery.expiresAt && delivery.expiresAt <= Date.now()) return null;
        if (delivery.category === "weekly" && delivery.createdAt < Date.now() - 7 * 86400000)
            return null;
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
            if (
                delivery.category === "campaign" &&
                subscription.weekly === false &&
                subscription.announcements === false
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
                return { ...delivery, unsubscribeToken: subscription?.token };
            }
            if (delivery.category === "cancelled") {
                if (event.status !== "cancelled") return null;
            } else if (
                event.status !== "scheduled" ||
                (delivery.category !== "confirmed" &&
                    delivery.category !== "update" &&
                    event.startsAt <= Date.now())
            )
                return null;
            if (delivery.category === "announcement" && event.visibility === "unlisted")
                return null;
            if (delivery.category === "confirmed" && isTentative(event)) return null;
            if (
                (delivery.category === "confirmed" ||
                    delivery.category === "cancelled" ||
                    delivery.category === "update") &&
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

        return {
            ...delivery,
            unsubscribeToken: subscription?.token,
        };
    },
});

/** Claim once, counting bulk attempts atomically and keeping provider retries within 24 hours. */
export const claim = internalMutation({
    args: { id: v.id("messages") },
    handler: async (ctx, args) => {
        const delivery = await ctx.db.get(args.id);
        const now = Date.now();
        if (
            !delivery ||
            delivery.status !== "queued" ||
            delivery.attempts >= 5 ||
            (delivery.nextAttemptAt ?? 0) > now
        )
            return false;
        if (!recipientAllowed(delivery.to)) return false;
        const controlled =
            delivery.campaignId && !delivery.isTest ? await ctx.db.get(delivery.campaignId) : null;
        if (
            controlled?.attemptLimit !== undefined &&
            (controlled.attempts ?? 0) >= controlled.attemptLimit
        )
            return false;
        if (delivery.campaignId && !delivery.isTest) {
            const campaign = await ctx.db.get(delivery.campaignId);
            if (!campaign || campaign.status !== "queued") return false;
            if (!(await canSend(ctx, campaign))) {
                await ctx.db.patch(campaign._id, {
                    status: "paused",
                    pauseReason: "Sender access changed. Review before resuming.",
                });
                return false;
            }
        }
        if (delivery.firstAttemptAt && now - delivery.firstAttemptAt > 20 * 3600000) {
            await updateMessage(ctx, delivery, {
                status: "failed",
                attempts: 5,
                nextAttemptAt: Number.MAX_SAFE_INTEGER,
                error: "Delivery needs provider reconciliation before retry.",
            });
            return false;
        }
        if (isBulk(delivery.category) && !(await reserve(ctx, now))) return false;
        // consume campaign and shared allowances atomically, including retries
        if (controlled?.attemptLimit !== undefined)
            await ctx.db.patch(controlled._id, { attempts: (controlled.attempts ?? 0) + 1 });
        await updateMessage(ctx, delivery, {
            status: "queued",
            claimedAt: now,
            firstAttemptAt: delivery.firstAttemptAt ?? now,
            nextAttemptAt: now + 300000,
            attempts: delivery.attempts + 1,
        });
        return true;
    },
});

/** Mark an obsolete queued message without sending or consuming quota. */
export const skip = internalMutation({
    args: { id: v.id("messages") },
    handler: async (ctx, args) => {
        const delivery = await ctx.db.get(args.id);
        if (delivery && delivery.status === "queued")
            await updateMessage(ctx, delivery, { status: "skipped" });
    },
});

/** Record provider acceptance separately from final delivery. */
export const finish = internalMutation({
    args: {
        id: v.id("messages"),
        providerId: v.optional(v.string()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const delivery = await ctx.db.get(args.id);
        if (!delivery || delivery.status === "accepted") return;
        const nextAttemptAt =
            delivery.attempts >= 5
                ? Number.MAX_SAFE_INTEGER
                : Date.now() + 60000 * 2 ** delivery.attempts;
        await updateMessage(ctx, delivery, {
            status: args.error ? (delivery.attempts >= 5 ? "failed" : "queued") : "accepted",
            error: args.error,
            providerId: args.providerId,
            nextAttemptAt,
        });
        if (args.providerId && isBulk(delivery.category)) {
            const settings = await ctx.db.query("mailQuota").unique();
            if (settings) await ctx.db.patch(settings._id, { accepted: settings.accepted + 1 });
        }
        if (args.providerId) await reconcile(ctx, args.providerId);
        if (args.error && delivery.attempts < 5 && !isBulk(delivery.category))
            await ctx.scheduler.runAt(nextAttemptAt, internal.mail.messages.deliver, {
                id: args.id,
            });
    },
});

/** Deliver only currently eligible mail after a successful quota and lease claim. */
export const deliver = internalAction({
    args: { id: v.id("messages") },
    handler: async (ctx, args) => {
        const delivery = await ctx.runQuery(internal.mail.messages.read, args);
        if (!delivery) {
            await ctx.runMutation(internal.mail.messages.skip, args);
            return;
        }
        if (!(await ctx.runMutation(internal.mail.messages.claim, args))) return;
        // recheck consent and event state after claiming, before contacting the provider
        const current = await ctx.runQuery(internal.mail.messages.read, args);
        if (!current) {
            await ctx.runMutation(internal.mail.messages.skip, args);
            return;
        }
        try {
            const result = await send({
                to: current.to,
                subject: current.subject,
                text: current.text,
                html: current.html,
                key: current.key,
                unsubscribeToken:
                    isBulk(current.category) || current.category === "followup"
                        ? current.unsubscribeToken
                        : undefined,
            });
            await ctx.runMutation(internal.mail.messages.finish, {
                id: args.id,
                providerId: result.id,
            });
        } catch (error) {
            await ctx.runMutation(internal.mail.messages.finish, {
                id: args.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    },
});
