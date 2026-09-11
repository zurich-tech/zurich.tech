import { activeSponsors } from "../sponsorships/organisations";
import { query, internalMutation, type QueryCtx } from "../_generated/server";

/** Read real totals without exposing accounts or email addresses. */
async function totals(ctx: QueryCtx) {
    const now = Date.now();
    const accounts = await ctx.db.query("accounts").collect();
    const subscriptions = await ctx.db
        .query("subscriptions")
        .withIndex("by_status", (q) => q.eq("status", "subscribed"))
        .collect();
    const events = await ctx.db.query("events").collect();
    const organisations = await ctx.db.query("organisations").collect();
    const sponsors = new Set((await activeSponsors(ctx)).map((sponsor) => sponsor.organisationId));
    const past = events.filter(
        (event) => event.status !== "draft" && event.status !== "cancelled" && event.startsAt < now,
    );

    return {
        members: accounts.filter((account) => account.status === "active").length,
        subscribers: subscriptions.filter(
            (subscription) =>
                subscription.verifiedAt !== undefined && subscription.weekly !== false,
        ).length,
        events: past.length,
        sponsors: sponsors.size,
        organisations: organisations.length,
        past,
    };
}

/** Read public community totals, observed growth, and the dated event archive. */
export const community = query({
    args: {},
    handler: async (ctx) => {
        const current = await totals(ctx);
        const history = await ctx.db.query("statistics").withIndex("by_date").collect();
        const date = (timestamp: number) =>
            new Intl.DateTimeFormat("en-CA", {
                timeZone: "Europe/Zurich",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
            }).format(timestamp);
        const today = date(Date.now());
        const cutoff = date(Date.now() - 30 * 86400000);

        // accumulate events on their actual dates
        const days = new Map<string, number>();
        for (const event of current.past) {
            const day = date(event.startsAt);
            days.set(day, (days.get(day) ?? 0) + 1);
        }
        let count = 0;
        const events = [...days]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, total]) => ({ date, value: (count += total) }));
        if (events.length && events.at(-1)!.date !== today)
            events.push({ date: today, value: count });

        // compare with the earliest daily total within the last month
        const growth = (field: "members" | "subscribers" | "sponsors" | "organisations") => {
            const baseline = history.find(
                (row) => row.date >= cutoff && row.date < today && row[field] !== undefined,
            );
            return baseline
                ? { value: current[field] - baseline[field]!, since: baseline.date }
                : null;
        };

        return {
            totals: {
                members: current.members,
                subscribers: current.subscribers,
                events: current.events,
                sponsors: current.sponsors,
                organisations: current.organisations,
            },
            events,
            growth: {
                events: {
                    value: current.past.filter((event) => date(event.startsAt) >= cutoff).length,
                    since: cutoff,
                },
                members: growth("members"),
                subscribers: growth("subscribers"),
                sponsors: growth("sponsors"),
                organisations: growth("organisations"),
            },
            history: [
                ...history
                    .filter((row) => row.date !== today)
                    .map((row) => ({
                        date: row.date,
                        members: row.members,
                        subscribers: row.subscribers,
                        events: row.events,
                        sponsors: row.sponsors,
                        organisations: row.organisations,
                    })),
                {
                    date: today,
                    members: current.members,
                    subscribers: current.subscribers,
                    events: current.events,
                    sponsors: current.sponsors,
                    organisations: current.organisations,
                },
            ],
        };
    },
});

/** Retain one daily observation instead of reconstructing growth from import dates. */
export const record = internalMutation({
    args: {},
    handler: async (ctx) => {
        const current = await totals(ctx);
        const date = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Zurich",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(Date.now());
        const existing = await ctx.db
            .query("statistics")
            .withIndex("by_date", (q) => q.eq("date", date))
            .unique();
        const values = {
            date,
            members: current.members,
            subscribers: current.subscribers,
            events: current.events,
            sponsors: current.sponsors,
            organisations: current.organisations,
        };
        if (existing) await ctx.db.patch(existing._id, values);
        else await ctx.db.insert("statistics", values);
    },
});
