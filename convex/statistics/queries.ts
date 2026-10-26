import { isListed } from "../events/visibility";
import { eventAttribution } from "../events/attribution";
import { query, internalMutation, type QueryCtx } from "../_generated/server";
import { cumulative, currentPoint, date, growth, subscriberHistory, eventHistory } from "./history";

/** Read totals and dated records without exposing identities through the public query. */
async function records(ctx: QueryCtx) {
    const [events, subscriptions, registrations, series] = await Promise.all([
        ctx.db.query("events").collect(),
        ctx.db.query("subscriptions").collect(),
        ctx.db.query("registrations").collect(),
        ctx.db.query("series").collect(),
    ]);
    const past = events.filter(
        (event) => isListed(event) && event.status !== "cancelled" && event.startsAt < Date.now(),
    );

    const listed = new Set(events.filter(isListed).map((event) => event._id));
    const publicRegistrations = registrations.filter((row) => listed.has(row.eventId));
    const seriesById = new Map(series.map((item) => [item._id, item]));
    const attributed = past.map((event) => ({
        at: event.startsAt,
        attribution: eventAttribution(
            event,
            event.seriesId ? seriesById.get(event.seriesId) : undefined,
        ),
    }));

    return {
        attributed,
        subscriptions,
        registrations: publicRegistrations,
        totals: {
            events: past.length,
            subscribers: subscriptions.filter((row) => row.status === "subscribed").length,
            registrations: publicRegistrations.length,
        },
    };
}

/** Count current community subscriptions without loading event or registration histories. */
export const subscribers = query({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db
            .query("subscriptions")
            .withIndex("by_status", (q) => q.eq("status", "subscribed"))
            .collect();

        return rows.length;
    },
});

/** Read event, subscription and registration growth from their dated histories. */
export const community = query({
    args: {},
    handler: async (ctx) => {
        const current = await records(ctx);
        const now = Date.now();
        const history = {
            events: eventHistory(current.attributed, now),
            subscribers: currentPoint(
                subscriberHistory(current.subscriptions, now),
                current.totals.subscribers,
                now,
            ),
            registrations: currentPoint(
                cumulative(
                    current.registrations.map((registration) => ({
                        at: registration.createdAt,
                        value: 1,
                    })),
                ),
                current.totals.registrations,
                now,
            ),
        };

        // use our event counts for the headline and growth, retaining both groups in the chart
        const ours = history.events.map((point) => ({ date: point.date, value: point.ours }));

        return {
            totals: { ...current.totals, events: ours.at(-1)!.value },
            history,
            growth: [30, 90, 365].map((days) => ({
                days,
                events: growth(ours, now, days),
                subscribers: growth(history.subscribers, now, days),
                registrations: growth(history.registrations, now, days),
            })),
        };
    },
});

/** Retain daily totals alongside the underlying dated records. */
export const record = internalMutation({
    args: {},
    handler: async (ctx) => {
        const current = await records(ctx);
        const today = date(Date.now());
        const existing = await ctx.db
            .query("statistics")
            .withIndex("by_date", (q) => q.eq("date", today))
            .unique();
        const values = { date: today, ...current.totals };
        if (existing) await ctx.db.patch(existing._id, values);
        else await ctx.db.insert("statistics", values);
    },
});
