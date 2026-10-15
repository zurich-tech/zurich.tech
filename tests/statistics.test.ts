import { expect, test } from "bun:test";
import { eventHistory } from "../convex/statistics/history";
import { eventAttribution } from "../convex/events/attribution";
import { convexTest, schema, modules, member } from "./backend";
import { api, internal } from "../convex/_generated/api";

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
    expect(result.totals.events).toBe(3);
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
