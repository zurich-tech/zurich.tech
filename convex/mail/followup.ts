import { requireAudienceDelivery } from "./policy";
import { eventPlace } from "../events/place";
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireEvent } from "../auth/grants";
import { requireMailSender } from "../auth/access";
import { receivesFollowUp as eligible } from "./audiences";
import { create } from "./campaigns";
import { links } from "./personalization";
import { requireMail } from "./provider";
import { eventEmail } from "./templates";
import { activeSponsors } from "../sponsorships/organisations";
import { openJobs } from "../jobs/jobs";

/** Compute the unsent audience used by both confirmation and sending. */
async function audience(ctx: QueryCtx, eventId: Doc<"events">["_id"]) {
    const event = await ctx.db.get(eventId);
    if (!event) throw new ConvexError("Event not found.");
    const rows = await ctx.db
        .query("registrations")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect();
    const recipients: string[] = [];
    for (const row of rows) {
        const sent = await ctx.db
            .query("messages")
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
        await requireMailSender(ctx);
        requireMail();
        requireAudienceDelivery();
        const actual = await audience(ctx, args.eventId);
        if (actual.receipt !== args.receipt)
            throw new ConvexError("Recipients changed. Review and confirm again.");
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
        const rows = await ctx.db
            .query("registrations")
            .withIndex("by_event", (q) => q.eq("eventId", event._id))
            .collect();
        const recipients = [];
        for (const row of rows) if (await eligible(ctx, event, row)) recipients.push(row._id);
        const hasFeedback = event.feedback?.isEventEnabled || event.feedback?.isSpeakerEnabled;
        await create(
            ctx,
            {
                key: `followup:${event._id}`,
                audience: {
                    kind: "registrations",
                    eventId: event._id,
                    status: event.checkIn?.isEnabled ? "attended" : "going",
                },
                category: "followup",
                eventId: event._id,
                seriesId: event.seriesId,
                expiresAt: event.endsAt + 7 * 86400000,
                content: eventEmail({ ...event, ...(await eventPlace(ctx, event)) }, "Thank you", {
                    unsubscribeUrl: links.unsubscribe,
                    sponsors: await activeSponsors(ctx),
                    jobs: await openJobs(ctx),
                    description: event.checkIn?.isEnabled
                        ? `Thanks for coming to ${event.title}.`
                        : `Thanks for your interest in ${event.title}.`,
                    manageUrl: links.registration + (hasFeedback ? "#feedback" : ""),
                    actionLabel: hasFeedback ? "Give feedback" : "View registration",
                }),
            },
            recipients,
        );
    },
});
