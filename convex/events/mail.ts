import { v } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireEvent } from "../auth/grants";
import { receivesAnnouncement } from "../mail/events";
import { requireMail } from "../mail/deliveries";
import { isTentative } from "./conditions";

/** Explicit event mail audiences. */
const kind = v.union(v.literal("announcement"), v.literal("reminder"));

/** Find an announcement already queued or delivered for this event. */
export async function isAnnounced(ctx: QueryCtx, event: Doc<"events">) {
    return (
        !!event.announcedAt ||
        !!(await ctx.db
            .query("deliveries")
            .withIndex("by_event_and_category", (q) =>
                q.eq("eventId", event._id).eq("category", "announcement"),
            )
            .first())
    );
}

/** Queue the event's single subscriber announcement after explicit consent. */
export async function queueAnnouncement(ctx: MutationCtx, event: Doc<"events">) {
    if (event.status !== "scheduled" || event.startsAt <= Date.now())
        throw new Error("Only upcoming published events can be announced.");
    if (await isAnnounced(ctx, event)) throw new Error("This event has already been announced.");
    requireMail();

    // record the request atomically before scheduling its bounded delivery batches
    const now = Date.now();
    await ctx.db.patch(event._id, { announcedAt: now });
    await ctx.scheduler.runAfter(0, internal.mail.events.announce, {
        eventId: event._id,
        publishedAt: now,
        cursor: null,
    });
}

/** Count eligible recipients using the same preferences and keys as delivery. */
async function audience(ctx: QueryCtx, event: Doc<"events">, intent: "announcement" | "reminder") {
    const now = Date.now();
    let reason: string | undefined;
    if (event.status !== "scheduled" || event.startsAt <= now)
        reason = "Only upcoming published events can be emailed.";
    else if (intent === "announcement" && (await isAnnounced(ctx, event)))
        reason = "Announcement already queued.";
    else if (intent === "reminder" && isTentative(event))
        reason = "Confirm the event before sending a reminder.";
    else if (intent === "reminder" && event.reminderStartsAt === event.startsAt)
        reason = "Reminder already queued.";

    // exclude opted-out recipients and registrations that already have a reminder
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const addresses: string[] = [];
    if (!reason && intent === "announcement") {
        for (const row of subscriptions)
            if (receivesAnnouncement(row, now)) addresses.push(row.email);
    } else if (!reason) {
        const preferences = new Map(subscriptions.map((row) => [row.email, row]));
        const deliveries = await ctx.db
            .query("deliveries")
            .withIndex("by_event_and_category", (q) =>
                q.eq("eventId", event._id).eq("category", "reminder"),
            )
            .collect();
        const keys = new Set(deliveries.map((row) => row.key));
        const registrations = await ctx.db
            .query("registrations")
            .withIndex("by_event", (q) => q.eq("eventId", event._id))
            .collect();
        for (const row of registrations) {
            const preference = preferences.get(row.email);
            if (
                row.status === "going" &&
                row.email &&
                preference?.status !== "suppressed" &&
                preference?.reminders !== false &&
                !keys.has(`reminder:${row._id}:${event.startsAt}`)
            )
                addresses.push(row.email);
        }
    }

    return {
        recipients: addresses.length,
        reason,
        receipt: JSON.stringify([
            event._id,
            event.updatedAt,
            event.startsAt,
            event.status,
            event.confirmedAt,
            event.announcedAt,
            event.reminderStartsAt,
            intent,
            reason,
            addresses.sort(),
        ]),
    };
}

/** Preview both mail actions without sending anything. */
export const preview = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        await requireEvent(ctx, args.eventId);
        const event = await ctx.db.get(args.eventId);
        if (!event) throw new Error("Event not found.");

        return {
            title: event.title,
            announcement: await audience(ctx, event, "announcement"),
            reminder: await audience(ctx, event, "reminder"),
        };
    },
});

/** Send explicitly confirmed event mail with a fresh recipient check. */
export const send = mutation({
    args: { eventId: v.id("events"), kind, receipt: v.string() },
    handler: async (ctx, args) => {
        await requireEvent(ctx, args.eventId);
        const event = await ctx.db.get(args.eventId);
        if (!event) throw new Error("Event not found.");
        const actual = await audience(ctx, event, args.kind);
        if (actual.reason) throw new Error(actual.reason);
        if (!actual.recipients) throw new Error("No eligible recipients.");
        if (actual.receipt !== args.receipt)
            throw new Error("The event or recipients changed. Please review and confirm again.");
        requireMail();

        // claim the action before scheduling work so repeated clicks cannot resend it
        if (args.kind === "announcement") await queueAnnouncement(ctx, event);
        else {
            await ctx.db.patch(event._id, { reminderStartsAt: event.startsAt });
            await ctx.scheduler.runAfter(0, internal.mail.events.remind, {
                eventId: event._id,
                cursor: null,
                manualAt: Date.now(),
                startsAt: event.startsAt,
            });
        }
    },
});
