/** Daily cumulative first signups, independent of current admission status. */
export type SignupDay = { date: string; added: number; total: number };

/** Aggregate native records by their immutable creation date in Zurich time. */
export function signupHistory(
    rows: { _creationTime: number; source?: string }[],
    until: number,
): SignupDay[] {
    const format = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });

    // exclude imports whose insertion time is not their signup time
    const counts = new Map<string, number>();
    for (const row of rows) {
        if (row.source || row._creationTime > until) continue;
        const date = format.format(row._creationTime);
        counts.set(date, (counts.get(date) ?? 0) + 1);
    }

    // retain quiet days so horizontal distance represents elapsed time
    const first = [...counts.keys()].sort()[0];
    if (!first) return [];
    const last = Date.parse(format.format(until));
    const days: SignupDay[] = [];
    let total = 0;
    for (let time = Date.parse(first); time <= last; time += 86_400_000) {
        const date = new Date(time).toISOString().slice(0, 10);
        const added = counts.get(date) ?? 0;
        total += added;
        days.push({ date, added, total });
    }

    return days;
}
