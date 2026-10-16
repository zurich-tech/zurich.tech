/** Dates available on a current or legacy published story. */
type DatedStory = {
    /** Immutable original story date, captured at first publication. */
    date?: number;
    /** Legacy published snapshot, before immutable dates were stored separately. */
    published?: { date?: number };
    /** Initial publication time, also retained after withdrawal. */
    publishedAt?: number;
};

/** Resolve the immutable date, including published records predating that field. */
export function newsDate(story: DatedStory): number {
    const date = story.date ?? story.published?.date ?? story.publishedAt;
    if (date === undefined || !Number.isFinite(date))
        throw new Error("Published news requires a valid story date.");

    return date;
}

/** Build the canonical news path using the original UTC calendar date. */
export function newsPath(story: { slug: string; date: number }): string {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(story.slug)) throw new Error("Invalid news slug.");
    const date = new Date(story.date).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid news date.");

    return `/news/${date.replaceAll("-", "/")}/${story.slug}`;
}
