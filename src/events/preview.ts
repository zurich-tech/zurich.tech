/** Dates and series needed to select a compact event programme. */
type PreviewEntry = { startsAt: number; seriesId?: string | null };

/** Show only the nearest upcoming edition per series. */
export function previewEvents<T extends PreviewEntry>(
    entries: T[],
    limit: number,
    now: number,
): T[] {
    // select upcoming editions chronologically, keeping standalone events independent
    const ordered = [...entries].sort((left, right) => left.startsAt - right.startsAt);
    const series = new Set<string>();

    return ordered
        .filter((event) => {
            if (event.startsAt < now || (event.seriesId && series.has(event.seriesId)))
                return false;
            if (event.seriesId) series.add(event.seriesId);

            return true;
        })
        .slice(0, limit);
}
