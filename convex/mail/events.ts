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
            if (
                subscription.announcements === false ||
                !subscription.verifiedAt ||
                subscription.verifiedAt > args.publishedAt ||
                !subscription.token
            )
                continue;
            const unsubscribe = `${siteOrigin()}/unsubscribe?token=${encodeURIComponent(subscription.token)}`;
            await enqueue(
                ctx,
                `announcement:${event._id}:${subscription._id}`,
                subscription.email,
                `New event: ${event.title}`,
                `${event.title}\n${new Date(event.startsAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich", dateStyle: "medium", timeStyle: "short" })} (Zürich time)\n${event.location ?? ""}\n\n${event.summary ?? ""}\n\n${siteOrigin()}/events/${event.slug}\n\nEmail preferences: ${siteOrigin()}/settings\nUnsubscribe: ${unsubscribe}`,
                subscription._id,
                position * 600,
                undefined,
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
    args: { eventId: v.id("events"), cursor: v.union(v.string(), v.null()) },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (
            !event ||
            event.status !== "scheduled" ||
            event.startsAt <= Date.now() ||
            event.startsAt > Date.now() + 86400000
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
                event.startsAt - (registration.approvedAt ?? registration.createdAt) < 86400000
            )
                continue;
            await enqueue(
                ctx,
                `reminder:${registration._id}:${event.startsAt}`,
                registration.email,
                `Reminder: ${event.title}`,
                `${event.title} is coming up.\n\n${new Date(event.startsAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich", dateStyle: "medium", timeStyle: "short" })} (Zürich time)\n${event.location ?? ""}\n\n${siteOrigin()}/events/${event.slug}${registration.token ? `\n\nManage your registration: ${siteOrigin()}/registration?token=${encodeURIComponent(registration.token)}` : ""}\n\nEmail preferences: ${siteOrigin()}/settings`,
                undefined,
                position * 600,
                undefined,
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
