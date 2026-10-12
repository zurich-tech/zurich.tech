import type { CalendarEntry } from "./queries";

/** Public activity used to introduce a series. */
type SeriesActivity<Event> = {
    /** Number of past, non-cancelled events. */
    held: number;
    /** Nearest scheduled event. */
    next?: Event;
    /** Most recent past event. */
    latest?: Event;
};

/** Group public occurrences in one pass without mutating the calendar. */
export function seriesActivity<
    Event extends Pick<CalendarEntry, "seriesId" | "startsAt" | "status">,
>(events: Event[], now: number) {
    const activity = new Map<string, SeriesActivity<Event>>();

    // exclude cancelled and private planning entries from public activity
    for (const event of events) {
        if (!event.seriesId || (event.status !== "scheduled" && event.status !== "finished"))
            continue;
        const item = activity.get(event.seriesId) ?? { held: 0 };
        activity.set(event.seriesId, item);

        // preserve the nearest future date and the most recent history
        if (event.startsAt >= now && event.status === "scheduled") {
            if (!item.next || event.startsAt < item.next.startsAt) item.next = event;
        } else if (event.startsAt < now) {
            item.held++;
            if (!item.latest || event.startsAt > item.latest.startsAt) item.latest = event;
        }
    }

    return activity;
}
