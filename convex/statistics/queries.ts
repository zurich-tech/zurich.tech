import { query, internalMutation, type QueryCtx } from "../_generated/server";
import { cumulative, currentPoint, date, growth, subscriberHistory } from "./history";

/** Read totals and dated records without exposing identities through the public query. */
async function records(ctx: QueryCtx) {
    const [events, subscriptions, registrations] = await Promise.all([
        ctx.db.query("events").collect(),
        ctx.db.query("subscriptions").collect(),
        ctx.db.query("registrations").collect(),
    ]);
    const past = events.filter(
        (event) =>
            event.status !== "draft" && event.status !== "cancelled" && event.startsAt < Date.now(),
    );

    return {
        past,
        subscriptions,
        registrations,
        totals: {
            events: past.length,
            subscribers: subscriptions.filter((row) => row.status === "subscribed").length,
            registrations: registrations.length,
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
            events: currentPoint(
                cumulative(current.past.map((event) => ({ at: event.startsAt, value: 1 }))),
                current.totals.events,
                now,
            ),
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

        return {
            totals: current.totals,
            history,
            growth: {
                events: growth(history.events, now),
                subscribers: growth(history.subscribers, now),
                registrations: growth(history.registrations, now),
            },
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
