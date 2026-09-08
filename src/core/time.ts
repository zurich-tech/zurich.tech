import { timeZone } from "./constants";

/** Calendar year in the event programme's local timezone. */
const year = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
});

/** Compare an instant with the current calendar year in Zürich. */
export function isCurrentYear(value: number, now = Date.now()): boolean {
    return year.format(value) === year.format(now);
}

/** Format an instant as an editable Zürich civil date and time. */
export function civilTime(value: number): string {
    const parts = new Intl.DateTimeFormat("sv-SE", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(new Date(value));

    return parts.replace(" ", "T");
}

/** Resolve an unambiguous Zürich civil time, rejecting daylight saving gaps and overlaps. */
export function timestamp(value: string): number {
    const nominal = Date.parse(`${value}Z`);
    if (!Number.isFinite(nominal)) throw new Error("Enter a valid date and time.");
    const candidates = [nominal - 3600000, nominal - 7200000].filter(
        (instant) => civilTime(instant) === value,
    );
    if (candidates.length !== 1)
        throw new Error(
            "This Zürich time is skipped or occurs twice during the daylight saving change. Choose another time.",
        );

    return candidates[0];
}
