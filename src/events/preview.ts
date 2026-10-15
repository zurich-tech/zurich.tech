/** Dates and series needed to select a compact event programme. */
type PreviewEntry = { startsAt: number; seriesId?: string | null };

/** Show the nearest edition per series, filling spare places with recent past events. */
export function previewEvents<T extends PreviewEntry>(
    entries: T[],
    limit: number,
    now: number,
): T[] {
    // select upcoming editions chronologically, keeping standalone events independent
    const ordered = [...entries].sort((left, right) => left.startsAt - right.startsAt);
    const series = new Set<string>();
    const upcoming = ordered
        .filter((event) => {
            if (event.startsAt < now || (event.seriesId && series.has(event.seriesId)))
                return false;
            if (event.seriesId) series.add(event.seriesId);

            return true;
        })
        .slice(0, limit);

    // retain the latest past events before the upcoming programme
    const remaining = limit - upcoming.length;
    const past =
        remaining > 0 ? ordered.filter((event) => event.startsAt < now).slice(-remaining) : [];

    return [...past, ...upcoming];
}
