import type { Doc } from "../_generated/dataModel";

/** One dated aggregate, with uncertainty retained for reconstructed subscription totals. */
export type Point = { date: string; value: number; isEstimated?: boolean };

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

/** Reconstruct active weekly subscribers, including opt-outs and resubscriptions. */
export function subscriberHistory(subscriptions: Doc<"subscriptions">[], now: number): Point[] {
    const changes: { at: number; value: number }[] = [];
    let estimatedUntil = 0;
    for (const subscription of subscriptions) {
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
            const next = change.status === "subscribed" && change.weekly;
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

/** Compare the current total with the dated total at the monthly cutoff. */
export function growth(points: Point[], now: number) {
    const cutoff = date(now - 30 * 86400000);
    const baseline = points.findLast((point) => point.date <= cutoff);
    if (!baseline) return null;

    return {
        value: points.at(-1)!.value - baseline.value,
        since: cutoff,
        isEstimated: baseline.isEstimated,
    };
}
