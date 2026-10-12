import { expect, test } from "bun:test";
import { seriesActivity } from "../src/events/activity";
import type { CalendarEntry } from "../src/events/queries";
import type { Id } from "../convex/_generated/dataModel";

/** Build only the event fields required by the directory. */
function event(
    startsAt: number,
    status: CalendarEntry["status"] = "scheduled",
    seriesId: string = "series",
) {
    return { startsAt, status, seriesId: seriesId as Id<"series"> };
}

test("test_select_nearest_next_and_latest_past_without_reordering_events", () => {
    const events = [event(30), event(5, "finished"), event(20), event(9), event(2)];
    const original = [...events];

    expect([...seriesActivity(events, 10)]).toEqual([
        ["series", { held: 3, next: events[2], latest: events[3] }],
    ]);
    expect(events).toEqual(original);
});

test("test_exclude_cancelled_events_and_keep_series_activity_separate", () => {
    const events = [
        event(5, "cancelled"),
        event(20, "cancelled"),
        event(10),
        event(1, "finished", "other"),
    ];

    expect([...seriesActivity(events, 10)]).toEqual([
        ["series", { held: 0, next: events[2] }],
        ["other", { held: 1, latest: events[3] }],
    ]);
    expect([...seriesActivity([], 10)]).toEqual([]);
    expect([...seriesActivity([{ ...event(20), seriesId: undefined }], 10)]).toEqual([]);
});
