import { expect, test } from "bun:test";
import { previewEvents } from "../src/events/preview";

test("test_select_nearest_edition_without_mutating_events", () => {
    const events = [
        { startsAt: 50, seriesId: "hack" },
        { startsAt: 30, seriesId: "talk" },
        { startsAt: 20, seriesId: "hack" },
        { startsAt: 40, seriesId: "hack" },
    ];
    const original = [...events];

    expect(previewEvents(events, 5, 10)).toEqual([events[2], events[1]]);
    expect(events).toEqual(original);
});

test("test_keep_standalone_events_and_limit_after_series_selection", () => {
    const events = [
        { startsAt: 10, seriesId: "hack" },
        { startsAt: 20, seriesId: "hack" },
        { startsAt: 30 },
        { startsAt: 40 },
        { startsAt: 50, seriesId: "talk" },
    ];

    expect(previewEvents(events, 3, 10)).toEqual([events[0], events[2], events[3]]);
});

test("test_omit_history_even_when_upcoming_events_do_not_fill_the_limit", () => {
    const events = [
        { startsAt: 1, seriesId: "hack" },
        { startsAt: 2, seriesId: "hack" },
        { startsAt: 3, seriesId: "hack" },
        { startsAt: 20, seriesId: "hack" },
        { startsAt: 30, seriesId: "hack" },
    ];

    expect(previewEvents(events, 3, 10)).toEqual([events[3]]);
    expect(previewEvents(events, 2, 100)).toEqual([]);
    expect(previewEvents([], 5, 10)).toEqual([]);
    expect(previewEvents(events, 0, 10)).toEqual([]);
});
