import type { Doc } from "../_generated/dataModel";

/** One dated aggregate, with uncertainty retained for reconstructed subscription totals. */
export type Point = { date: string; value: number; isEstimated?: boolean };

/** Cumulative events on a shared calendar, with disjoint organiser counts. */
export type EventPoint = Point & { ours: number; external: number };

/** Accumulate both organiser groups on the same dates without interpolating missing groups. */
export function eventHistory(
    events: { at: number; attribution: "ours" | "external" }[],
    now: number,
): EventPoint[] {
    // group occurrences before accumulating either series
    const days = new Map<string, { ours: number; external: number }>();
    for (const event of events) {
        const day = date(event.at);
        const counts = days.get(day) ?? { ours: 0, external: 0 };
        counts[event.attribution]++;
        days.set(day, counts);
    }
    if (!days.has(date(now))) days.set(date(now), { ours: 0, external: 0 });

    // carry each group's total forward, including today's terminal observation
    let ours = 0;
    let external = 0;

    return [...days]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, counts]) => {
            ours += counts.ours;
            external += counts.external;

            return { date, value: ours + external, ours, external };
        });
}

/** Calendar shared by every point in a query. */
const calendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

/** Group timestamps by the community’s local calendar date. */
export function date(timestamp: number) {
    return calendar.format(timestamp);
}

/** Accumulate dated additions and removals into daily totals. */
export function cumulative(changes: { at: number; value: number }[]): Point[] {
    const days = new Map<string, number>();
    for (const change of changes) {
        const day = date(change.at);
        days.set(day, (days.get(day) ?? 0) + change.value);
    }
    let value = 0;

    return [...days]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, change]) => ({ date, value: (value += change) }));
}

/** Reconstruct non-suppressed subscriptions, including opt-outs and resubscriptions. */
export function subscriberHistory(subscriptions: Doc<"subscriptions">[], now: number): Point[] {
    const changes: { at: number; value: number }[] = [];
    let estimatedUntil = 0;
    for (const subscription of subscriptions) {
        // exclude suppressed contacts from the whole timeline, not as departures on cleanup day
        if (subscription.status === "suppressed") continue;

        const history = subscription.history ?? [
            {
                at: subscription.createdAt,
                status: subscription.status,
                weekly: subscription.weekly !== false,
                isEstimated: true,
            },
        ];
        let active = false;
        for (const change of history) {
            if (change.at > now) continue;
            const next = change.status === "subscribed";
            changes.push({ at: change.at, value: Number(next) - Number(active) });
            active = next;
            if (change.isEstimated) estimatedUntil = Math.max(estimatedUntil, change.at);
        }
    }

    const cutoff = date(estimatedUntil);

    return cumulative(changes).map((point) => ({ ...point, isEstimated: point.date < cutoff }));
}

/** Add the current total without manufacturing historical observations. */
export function currentPoint(points: Point[], value: number, now: number): Point[] {
    const today = date(now);

    return [...points.filter((point) => point.date !== today), { date: today, value }];
}

/** Compare the current total with the dated total at the requested rolling cutoff. */
export function growth(points: Point[], now: number, days = 30) {
    const cutoff = date(now - days * 86400000);
    const baseline = points.findLast((point) => point.date <= cutoff);
    if (!baseline) return null;

    return {
        value: points.at(-1)!.value - baseline.value,
        since: cutoff,
        isEstimated: baseline.isEstimated,
    };
}
