import { eventPlace } from "../events/place";
import { isTentative } from "../events/conditions";
import type { Doc } from "../_generated/dataModel";
import { eventEmail } from "./templates";
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { create } from "./campaigns";
import { select } from "./audiences";
import { links } from "./personalization";
import { readProgramme } from "./programme";
import { activeSponsors } from "../sponsorships/organisations";
import { openJobs } from "../jobs/jobs";

/** Announce one published event to the audience present at publication. */
export const announce = internalMutation({
    args: {
        eventId: v.id("events"),
        publishedAt: v.number(),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (
            !event ||
            event.visibility === "unlisted" ||
            event.status !== "scheduled" ||
            event.startsAt <= Date.now()
        )
            return;
        const subscriptions = await ctx.db
            .query("subscriptions")
            .withIndex("by_status", (q) => q.eq("status", "subscribed"))
            .collect();
        await create(
            ctx,
            {
                key: `announcement:${event._id}`,
                audience: { kind: "subscribers" },
                category: "announcement",
                eventId: event._id,
                seriesId: event.seriesId,
                expiresAt: event.startsAt,
                content: eventEmail({ ...event, ...(await eventPlace(ctx, event)) }, "New event", {
                    eventId: event._id,
                    programme: await readProgramme(ctx, event._id),
                    sponsors: await activeSponsors(ctx),
                    jobs: await openJobs(ctx),
                    summary: true,
                    unsubscribeUrl: links.unsubscribe,
                }),
            },
            subscriptions
                .filter((row) => receivesAnnouncement(row, args.publishedAt))
                .map((row) => row._id),
        );
    },
});

/** Find upcoming events for the next day's attendee reminders. */
export const tick = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const events = await ctx.db
            .query("events")
            .withIndex("by_status_and_start", (q) =>
                q
                    .eq("status", "scheduled")
                    .gt("startsAt", now)
                    .lte("startsAt", now + 86400000),
            )
            .collect();
        for (const event of events)
            await ctx.scheduler.runAfter(0, internal.mail.events.remind, {
                eventId: event._id,
                cursor: null,
            });
    },
});

/** Freeze eligible registrations; manual and automatic reminders share delivery keys. */
export const remind = internalMutation({
    args: {
        eventId: v.id("events"),
        cursor: v.union(v.string(), v.null()),
        manualAt: v.optional(v.number()),
        startsAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (
            !event ||
            event.status !== "scheduled" ||
            isTentative(event) ||
            event.startsAt <= Date.now() ||
            (args.startsAt !== undefined && event.startsAt !== args.startsAt) ||
            (!args.manualAt && event.startsAt > Date.now() + 86400000)
        )
            return;
        const audience = {
            kind: "registrations" as const,
            eventId: event._id,
            status: "going" as const,
        };
        const selected = await select(ctx, audience, "reminder");
        const recipients = [];
        for (const id of selected.recipients) {
            const row = await ctx.db.get(id);
            if (!row || !("eventId" in row)) continue;
            if (
                args.manualAt
                    ? row.createdAt > args.manualAt
                    : event.startsAt - (row.approvedAt ?? row.createdAt) < 86400000
            )
                continue;
            recipients.push(id);
        }
        await create(
            ctx,
            {
                key: `reminder:${event._id}:${event.startsAt}:${args.manualAt ? "manual" : "automatic"}`,
                audience,
                category: "reminder",
                eventId: event._id,
                seriesId: event.seriesId,
                startsAt: event.startsAt,
                expiresAt: event.startsAt,
                content: eventEmail(
                    {
                        ...event,
                        ...(await eventPlace(ctx, event)),
                        addressAccess:
                            event.addressAccess?.kind === "confirmed"
                                ? { kind: "public" }
                                : event.addressAccess,
                    },
                    "Event reminder",
                    {
                        subject: "Reminder",
                        sponsors: await activeSponsors(ctx),
                        jobs: await openJobs(ctx),
                        programme: await readProgramme(ctx, event._id),
                        passUrl: event.checkIn?.isEnabled ? links.pass : undefined,
                        manageUrl: links.registration,
                    },
                ),
            },
            recipients,
        );
    },
});

/** Apply announcement preferences and the publication cutoff to a subscriber. */
export function receivesAnnouncement(
    subscription: Doc<"subscriptions">,
    publishedAt: number,
): subscription is Doc<"subscriptions"> & { token: string } {
    return (
        subscription.status === "subscribed" &&
        subscription.announcements !== false &&
        !!subscription.token &&
        (subscription.verifiedAt ?? subscription.createdAt) <= publishedAt
    );
}

/** Notify active registrants when a tentative event is confirmed or cancelled. */
export const outcome = internalMutation({
    args: {
        eventId: v.id("events"),
        outcome: v.union(v.literal("confirmed"), v.literal("cancelled")),
        description: v.optional(v.string()),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event) return;
        await create(ctx, {
            key: `event-${args.outcome}:${event._id}`,
            audience: { kind: "registrations", eventId: event._id, status: "active" },
            category: args.outcome,
            eventId: event._id,
            seriesId: event.seriesId,
            content: eventEmail(
                { ...event, ...(await eventPlace(ctx, event)) },
                args.outcome === "confirmed" ? "Event confirmed" : "Event cancelled",
                {
                    description:
                        args.outcome === "confirmed"
                            ? "The event is going ahead. Your registration status is unchanged."
                            : args.description,
                    manageUrl: links.registration,
                },
            ),
        });
    },
});
