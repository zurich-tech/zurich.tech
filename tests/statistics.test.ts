import { expect, test } from "bun:test";
import { eventHistory, growth } from "../convex/statistics/history";
import { eventAttribution } from "../convex/events/attribution";
import { convexTest, schema, modules, member } from "./backend";
import { api, internal } from "../convex/_generated/api";
import { insertSubscription, updateSubscription } from "../convex/mail/contacts";
import { currentPoint, subscriberHistory } from "../convex/statistics/history";
import { insertRegistration, updateRegistration } from "../convex/events/roster";

test("test_keep_incremental_subscriber_history_equal_to_source_records", async () => {
    const backend = convexTest(schema, modules);
    const at = Date.now() - 10 * 86400000;
    const id = await backend.run((ctx) =>
        insertSubscription(ctx, {
            email: "person@example.invalid",
            status: "subscribed",
            createdAt: at,
            updatedAt: at,
        }),
    );
    for (const status of ["unsubscribed", "subscribed", "suppressed", "subscribed"] as const) {
        await backend.run(async (ctx) => {
            const row = (await ctx.db.get(id))!;
            await updateSubscription(ctx, id, {
                status,
                history: [
                    ...(row.history ?? [
                        {
                            at,
                            status: "subscribed",
                            weekly: true,
                            source: "import",
                            isEstimated: true,
                        },
                    ]),
                    { at: at + 86400000, status, weekly: true, source: "test" },
                ],
            });
        });
        const sources = await backend.run((ctx) => ctx.db.query("subscriptions").collect());
        const count = sources.filter((row) => row.status === "subscribed").length;
        const result = await backend.query(api.statistics.queries.community, {});
        expect(result.totals.subscribers).toBe(count);
        expect(result.history.subscribers).toEqual(
            currentPoint(subscriberHistory(sources, Date.now()), count, Date.now()),
        );
    }
});

test("test_update_calendar_counts_without_changing_signup_history_on_cancellation", async () => {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const ownerId = await member(ctx, {
            name: "Host",
            searchText: "host",
            visibility: "public",
        });
        const eventId = await ctx.db.insert("events", {
            ownerId,
            slug: "counts",
            title: "Counts",
            topics: [],
            format: "talk",
            status: "scheduled",
            startsAt: Date.now() + 86400000,
            registration: { kind: "none" },
            createdAt: 1,
            updatedAt: 1,
        });
        const going = await insertRegistration(ctx, {
            eventId,
            email: "going@example.invalid",
            name: "Going",
            status: "going",
            createdAt: 1,
            updatedAt: 1,
        });
        const waiting = await insertRegistration(ctx, {
            eventId,
            email: "waiting@example.invalid",
            name: "Waiting",
            status: "waitlist",
            createdAt: 1,
            updatedAt: 1,
        });

        return { eventId, going, waiting };
    });
    const history = (await backend.query(api.statistics.queries.community, {})).history
        .registrations;
    await backend.run(async (ctx) => {
        await updateRegistration(ctx, ids.going, { status: "cancelled" });
        await updateRegistration(ctx, ids.waiting, { status: "going" });
    });
    const calendar = await backend.query(api.events.queries.calendar, {});
    expect(
        calendar.map((row) => ({ id: row.id, going: row.rsvpCount, waiting: row.waitlistCount })),
    ).toEqual([{ id: ids.eventId, going: 1, waiting: 0 }]);
    expect(
        (await backend.query(api.statistics.queries.community, {})).history.registrations,
    ).toEqual(history);
    await backend.run((ctx) => ctx.db.patch(ids.eventId, { visibility: "unlisted" }));
    expect((await backend.query(api.statistics.queries.community, {})).totals.registrations).toBe(
        0,
    );
});

test("test_compare_rolling_periods_without_inventing_missing_history", () => {
    const now = Date.parse("2026-10-26T12:00:00Z");
    const points = [
        { date: "2025-10-26", value: 10, isEstimated: true },
        { date: "2026-07-28", value: 30 },
        { date: "2026-09-26", value: 45 },
        { date: "2026-10-26", value: 42 },
    ];
    expect(growth(points, now, 30)).toMatchObject({ value: -3, since: "2026-09-26" });
    expect(growth(points, now, 90)).toMatchObject({ value: 12, since: "2026-07-28" });
    expect(growth(points, now, 365)).toMatchObject({ value: 32, isEstimated: true });
    expect(growth(points.slice(1), now, 365)).toBeNull();
    expect(growth([], now, 30)).toBeNull();
});

test("test_resolve_organiser_attribution_without_ticketing_inference", () => {
    expect(eventAttribution({}, { attribution: "ours" })).toBe("ours");
    expect(eventAttribution({ attribution: "external" }, { attribution: "ours" })).toBe("external");
    expect(eventAttribution({ attribution: "ours" }, { attribution: "external" })).toBe("ours");
    expect(eventAttribution({})).toBe("external");
});

test("test_accumulate_disjoint_event_groups_on_one_calendar", () => {
    expect(
        eventHistory(
            [
                { at: Date.parse("2026-10-12T12:00:00Z"), attribution: "external" },
                { at: Date.parse("2026-10-10T12:00:00Z"), attribution: "ours" },
                { at: Date.parse("2026-10-12T13:00:00Z"), attribution: "ours" },
            ],
            Date.parse("2026-10-15T12:00:00Z"),
        ),
    ).toEqual([
        { date: "2026-10-10", value: 1, ours: 1, external: 0 },
        { date: "2026-10-12", value: 3, ours: 2, external: 1 },
        { date: "2026-10-15", value: 3, ours: 2, external: 1 },
    ]);
});

test("test_keep_today_once_and_represent_empty_history", () => {
    const now = Date.parse("2026-10-15T12:00:00Z");
    expect(eventHistory([], now)).toEqual([{ date: "2026-10-15", value: 0, ours: 0, external: 0 }]);
    expect(eventHistory([{ at: now, attribution: "external" }], now)).toEqual([
        { date: "2026-10-15", value: 1, ours: 0, external: 1 },
    ]);
});

test("test_count_only_listed_past_events_with_series_and_event_attribution", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const ownerId = await member(ctx, {
            name: "Organiser",
            searchText: "organiser",
            visibility: "public",
        });
        const seriesId = await ctx.db.insert("series", {
            name: "Our series",
            slug: "ours",
            status: "active",
            description: "",
            topics: [],
            attribution: "ours",
        });
        const base = {
            ownerId,
            seriesId,
            slug: "historical",
            title: "Historical",
            topics: [],
            format: "talk" as const,
            status: "finished" as const,
            registration: { kind: "external" as const, url: "https://example.org/register" },
            startsAt: 1000,
            createdAt: 1,
            updatedAt: 1,
        };
        await ctx.db.insert("events", base);
        await ctx.db.insert("events", {
            ...base,
            slug: "external-override",
            attribution: "external",
            startsAt: Date.now() - 1000,
        });
        await ctx.db.insert("events", {
            ...base,
            slug: "standalone",
            seriesId: undefined,
            attribution: "ours",
        });
        await ctx.db.insert("events", { ...base, slug: "unlisted", visibility: "unlisted" });
        await ctx.db.insert("events", { ...base, slug: "cancelled", status: "cancelled" });
        await ctx.db.insert("events", { ...base, slug: "draft", status: "draft" });
        await ctx.db.insert("events", {
            ...base,
            slug: "future",
            startsAt: Date.now() + 86400000,
            status: "scheduled",
        });
    });

    const result = await backend.query(api.statistics.queries.community, {});
    expect(result.totals.events).toBe(2);
    expect(result.growth.map((period) => period.events?.value)).toEqual([0, 0, 0]);
    expect(result.history.events.at(-1)).toMatchObject({ value: 3, ours: 2, external: 1 });
    expect(
        result.history.events.every((point) => point.value === point.ours + point.external),
    ).toBe(true);

    // keep badges consistent with attribution, not the registration provider
    const calendar = await backend.query(api.events.queries.calendar, {});
    expect(calendar.find((event) => event.slug === "historical")?.isPartner).toBe(false);
    expect(calendar.find((event) => event.slug === "external-override")?.isPartner).toBe(true);
    expect(calendar.find((event) => event.slug === "standalone")?.isPartner).toBe(false);
    const detail = await backend.query(api.events.queries.event, { slug: "historical" });
    expect(detail?.isPartner).toBe(false);
});

test("test_classification_dry_run_and_missing_record_are_non_mutating", async () => {
    const backend = convexTest(schema, modules);
    const id = await backend.run((ctx) =>
        ctx.db.insert("series", {
            name: "Series",
            slug: "reviewed",
            status: "active",
            description: "",
            topics: [],
        }),
    );
    const series = [{ slug: "reviewed", attribution: "ours" as const }];
    await backend.mutation(internal.statistics.classification.classify, { series, apply: false });
    expect((await backend.run((ctx) => ctx.db.get(id)))?.attribution).toBeUndefined();
    await expect(
        backend.mutation(internal.statistics.classification.classify, {
            series,
            events: [{ slug: "missing", attribution: "ours" }],
            apply: true,
        }),
    ).rejects.toThrow("Event not found: missing.");
    expect((await backend.run((ctx) => ctx.db.get(id)))?.attribution).toBeUndefined();
    await backend.mutation(internal.statistics.classification.classify, { series, apply: true });
    expect(await backend.run(async (ctx) => (await ctx.db.get(id))?.attribution)).toBe("ours");
});

test("test_milestones_use_public_event_dates_and_links", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const ownerId = await member(ctx, {
            name: "Organiser",
            searchText: "organiser",
            visibility: "public",
        });
        const base = {
            ownerId,
            title: "Launch",
            topics: [],
            format: "talk" as const,
            status: "finished" as const,
            registration: { kind: "external" as const, url: "https://example.org/register" },
            startsAt: Date.parse("2023-03-21T17:00:00Z"),
            createdAt: 1,
            updatedAt: 1,
        };
        await ctx.db.insert("events", { ...base, slug: "zurichnlp-1" });
        await ctx.db.insert("events", { ...base, slug: "zurichcv-1", visibility: "unlisted" });
        await ctx.db.insert("events", { ...base, slug: "zurichrobotics-1", status: "draft" });
        await ctx.db.insert("events", { ...base, slug: "jurgen-schmidhuber", status: "cancelled" });
    });

    const result = await backend.query(api.statistics.queries.community, {});
    expect(result.milestones).toEqual([
        {
            slug: "zurichnlp-1",
            date: "2023-03-21",
            label: "ZurichNLP",
            description: "ZurichNLP launched",
            href: "/events/zurichnlp-1",
        },
        {
            date: "2026-09-09",
            label: "zurich.tech",
            description: "ZurichAI became zurich.tech",
            href: "/news/2026/09/28/introducing-zurich-tech",
        },
    ]);
});
