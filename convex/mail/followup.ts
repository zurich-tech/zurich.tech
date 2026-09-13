import { v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireEvent } from "../auth/grants";
import { isTentative } from "../events/conditions";
import { siteOrigin } from "../auth/environment";
import { enqueue, requireMail } from "./deliveries";
import { eventEmail } from "./templates";

/** Recheck the recipient, admission and attendance policy before delivery. */
export async function eligible(ctx: QueryCtx, event: Doc<"events">, row: Doc<"registrations">) {
    if (
        !event.followUp?.isEnabled ||
        !event.endsAt ||
        event.endsAt > Date.now() ||
        event.status === "cancelled" ||
        event.status === "draft" ||
        isTentative(event) ||
        row.status !== "going" ||
        !row.token
    )
        return false;
    const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_email", (q) => q.eq("email", row.email))
        .unique();
    if (
        subscription?.status === "suppressed" ||
        subscription?.followUps === false ||
        (subscription?.status === "unsubscribed" && subscription.followUps !== true)
    )
        return false;
    if (!event.checkIn?.isEnabled) return true;
    return !!(await ctx.db
        .query("attendances")
        .withIndex("by_registrationId", (q) => q.eq("registrationId", row._id))
        .unique());
}

/** Compute the unsent audience used by both confirmation and sending. */
async function audience(ctx: QueryCtx, eventId: Doc<"events">["_id"]) {
    const event = await ctx.db.get(eventId);
    if (!event) throw new Error("Event not found.");
    const rows = await ctx.db
        .query("registrations")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect();
    const recipients: string[] = [];
    for (const row of rows) {
        const sent = await ctx.db
            .query("deliveries")
            .withIndex("by_key", (q) => q.eq("key", `followup:${row._id}`))
            .unique();
        if (!sent && (await eligible(ctx, event, row))) recipients.push(row._id);
    }
    return {
        title: event.title,
        emails: recipients.length,
        receipt: JSON.stringify([event.updatedAt, recipients.sort()]),
    };
}

/** Preview a manual follow-up without sending it. */
export const preview = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        await requireEvent(ctx, args.eventId);
        return await audience(ctx, args.eventId);
    },
});

/** Queue a confirmed manual follow-up using the same once-only delivery key. */
export const send = mutation({
    args: { eventId: v.id("events"), receipt: v.string() },
    handler: async (ctx, args) => {
        await requireEvent(ctx, args.eventId);
        requireMail();
        const actual = await audience(ctx, args.eventId);
        if (actual.receipt !== args.receipt)
            throw new Error("Recipients changed. Review and confirm again.");
        await ctx.scheduler.runAfter(0, internal.mail.followup.deliver, {
            eventId: args.eventId,
            cursor: null,
            isManual: true,
        });
    },
});

/** Send after the current end and delay, rechecking policy in every bounded batch. */
export const deliver = internalMutation({
    args: {
        eventId: v.id("events"),
        cursor: v.union(v.string(), v.null()),
        isManual: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (
            !event?.followUp?.isEnabled ||
            !event.endsAt ||
            (!args.isManual && Date.now() < event.endsAt + event.followUp.delayHours * 3600000)
        )
            return;
        const page = await ctx.db
            .query("registrations")
            .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
            .paginate({ numItems: 100, cursor: args.cursor });
        for (const [position, row] of page.page.entries()) {
            if (!(await eligible(ctx, event, row))) continue;
            // keep the unsubscribe destination available to guests as well as members
            const subscription = await ctx.db
                .query("subscriptions")
                .withIndex("by_email", (q) => q.eq("email", row.email))
                .unique();
            const token = subscription?.token ?? crypto.randomUUID() + crypto.randomUUID();
            if (subscription && !subscription.token)
                await ctx.db.patch(subscription._id, { token });
            if (!subscription)
                await ctx.db.insert("subscriptions", {
                    email: row.email,
                    memberId: row.memberId,
                    status: "unsubscribed",
                    weekly: false,
                    announcements: false,
                    followUps: true,
                    token,
                    source: "registration",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                });
            const hasFeedback = event.feedback?.isEventEnabled || event.feedback?.isSpeakerEnabled;
            const message = eventEmail(event, "Thank you", {
                unsubscribeUrl: `${siteOrigin()}/unsubscribe?token=${encodeURIComponent(token)}`,
                description: event.checkIn?.isEnabled
                    ? `Thanks for coming to ${event.title}.`
                    : `Thanks for your interest in ${event.title}.`,
                manageUrl: `${siteOrigin()}/registration?token=${encodeURIComponent(row.token!)}${hasFeedback ? "#feedback" : ""}`,
                actionLabel: hasFeedback ? "Give feedback" : "View registration",
            });
            await enqueue(
                ctx,
                `followup:${row._id}`,
                row.email,
                message.subject,
                message.text,
                undefined,
                position * 600,
                message.html,
                { category: "followup", eventId: event._id, registrationId: row._id },
            );
        }
        if (!page.isDone)
            await ctx.scheduler.runAfter(page.page.length * 600, internal.mail.followup.deliver, {
                ...args,
                cursor: page.continueCursor,
            });
    },
});
