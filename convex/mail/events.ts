import { ensureToken } from "../events/checkin";
import { isTentative } from "../events/conditions";
import type { Doc } from "../_generated/dataModel";
import { eventEmail } from "./templates";
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { siteOrigin } from "../auth/environment";
import { enqueue } from "./deliveries";

/** Announce a newly published event once to each subscriber. */
export const announce = internalMutation({
    args: {
        eventId: v.id("events"),
        publishedAt: v.number(),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event || event.status !== "scheduled" || event.startsAt <= Date.now()) return;
        const page = await ctx.db
            .query("subscriptions")
            .withIndex("by_status", (q) => q.eq("status", "subscribed"))
            .paginate({ numItems: 100, cursor: args.cursor });
        for (const [position, subscription] of page.page.entries()) {
            if (!receivesAnnouncement(subscription, args.publishedAt)) continue;
            const unsubscribe = `${siteOrigin()}/unsubscribe?token=${encodeURIComponent(subscription.token)}`;
            const message = eventEmail(event, "New event", {
                summary: true,
                unsubscribeUrl: unsubscribe,
            });
            await enqueue(
                ctx,
                `announcement:${event._id}:${subscription._id}`,
                subscription.email,
                message.subject,
                message.text,
                subscription._id,
                position * 600,
                message.html,
                { category: "announcement", eventId: event._id },
            );
        }

        // continue in bounded batches without sending an event twice
        if (!page.isDone)
            await ctx.scheduler.runAfter(page.page.length * 600, internal.mail.events.announce, {
                ...args,
                cursor: page.continueCursor,
            });
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

/** Queue one reminder per confirmed registration, rechecking eligibility on delivery. */
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
        const page = await ctx.db
            .query("registrations")
            .withIndex("by_event", (q) => q.eq("eventId", event._id))
            .paginate({ numItems: 100, cursor: args.cursor });
        for (const [position, registration] of page.page.entries()) {
            // the confirmation already serves as a reminder for last-minute registrations
            if (
                registration.status !== "going" ||
                (args.manualAt
                    ? registration.createdAt > args.manualAt
                    : event.startsAt - (registration.approvedAt ?? registration.createdAt) <
                      86400000)
            )
                continue;
            const message = eventEmail(event, "Event reminder", {
                subject: "Reminder",
                passUrl: event.checkIn?.isEnabled
                    ? `${process.env.CONVEX_SITE_URL}/passes/qr?token=${encodeURIComponent(await ensureToken(ctx, registration))}`
                    : undefined,
                manageUrl: registration.token
                    ? `${siteOrigin()}/registration?token=${encodeURIComponent(registration.token)}`
                    : undefined,
            });
            await enqueue(
                ctx,
                `reminder:${registration._id}:${event.startsAt}`,
                registration.email,
                message.subject,
                message.text,
                undefined,
                position * 600,
                message.html,
                {
                    category: "reminder",
                    eventId: event._id,
                    registrationId: registration._id,
                    startsAt: event.startsAt,
                },
            );
        }

        if (!page.isDone)
            await ctx.scheduler.runAfter(page.page.length * 600, internal.mail.events.remind, {
                ...args,
                cursor: page.continueCursor,
            });
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

/** Deliver final event outcomes in bounded batches to active registrants. */
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
        const page = await ctx.db
            .query("registrations")
            .withIndex("by_event", (q) => q.eq("eventId", event._id))
            .paginate({ numItems: 100, cursor: args.cursor });
        for (const [position, row] of page.page.entries()) {
            if (!row.email || row.status === "cancelled" || row.status === "declined") continue;
            const message = eventEmail(
                event,
                args.outcome === "confirmed" ? "Event confirmed" : "Event cancelled",
                {
                    passUrl:
                        args.outcome === "confirmed" &&
                        row.status === "going" &&
                        event.checkIn?.isEnabled
                            ? `${process.env.CONVEX_SITE_URL}/passes/qr?token=${encodeURIComponent(await ensureToken(ctx, row))}`
                            : undefined,
                    description:
                        args.outcome === "confirmed"
                            ? "The event is going ahead. Your registration status is unchanged."
                            : args.description,
                    manageUrl: row.token
                        ? `${siteOrigin()}/registration?token=${encodeURIComponent(row.token)}`
                        : undefined,
                },
            );
            await enqueue(
                ctx,
                `event-${args.outcome}:${event._id}:${row._id}`,
                row.email,
                message.subject,
                message.text,
                undefined,
                position * 600,
                message.html,
                { category: args.outcome, eventId: event._id, registrationId: row._id },
            );
        }
        if (!page.isDone)
            await ctx.scheduler.runAfter(page.page.length * 600, internal.mail.events.outcome, {
                ...args,
                cursor: page.continueCursor,
            });
    },
});
