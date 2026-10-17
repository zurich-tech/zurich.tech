import { ConvexError, v, type Infer } from "convex/values";
import { civilTime, timestamp } from "./time";

/** Civil recurrence rules; weekdays run Monday (0) through Sunday (6). */
export const recurrence = v.object({
    frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    interval: v.number(),
    weekdays: v.array(v.number()),
    start: v.string(),
    end: v.optional(v.string()),
    time: v.string(),
    timezone: v.literal("Europe/Zurich"),
    excluded: v.array(v.string()),
});
export type Recurrence = Infer<typeof recurrence>;
const day = 86400000;

/** Validate dates without accepting JavaScript's overflow normalization. */
export function dateValue(value: string) {
    const result = Date.parse(`${value}T12:00:00Z`);
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(result) ||
        new Date(result).toISOString().slice(0, 10) !== value
    )
        throw new ConvexError("Enter a valid date.");
    return result;
}

/** Validate bounded recurrence rules before generating occurrences. */
export function validateRecurrence(rule: Recurrence) {
    const start = dateValue(rule.start);
    if (rule.end && dateValue(rule.end) < start)
        throw new ConvexError("The end date must follow the start date.");
    if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 52)
        throw new ConvexError("Use an interval between 1 and 52.");
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.time))
        throw new ConvexError("Enter a valid time.");
    if (
        rule.weekdays.some((value) => !Number.isInteger(value) || value < 0 || value > 6) ||
        (rule.frequency === "weekly" && !rule.weekdays.length)
    )
        throw new ConvexError("Choose at least one weekday.");
    if (rule.excluded.length > 366) throw new ConvexError("Use at most 366 skipped dates.");
    rule.excluded.forEach(dateValue);
}

/** Generate a bounded civil-date window, preserving local time across DST. */
export function occurrences(rule: Recurrence, now: number, horizon = 42) {
    const start = dateValue(rule.start);
    const today = dateValue(civilTime(now).slice(0, 10));
    const origin = new Date(start);
    const monday = start - ((origin.getUTCDay() + 6) % 7) * day;
    const dates: { date: string; startsAt: number }[] = [];
    const errors: string[] = [];
    for (let value = Math.max(start, today); value <= today + horizon * day; value += day) {
        const date = new Date(value);
        const text = date.toISOString().slice(0, 10);
        if (rule.end && text > rule.end) break;
        if (rule.excluded.includes(text)) continue;
        const weekday = (date.getUTCDay() + 6) % 7;
        const months =
            (date.getUTCFullYear() - origin.getUTCFullYear()) * 12 +
            date.getUTCMonth() -
            origin.getUTCMonth();
        const matches =
            rule.frequency === "daily"
                ? ((value - start) / day) % rule.interval === 0
                : rule.frequency === "weekly"
                  ? Math.floor((value - monday) / day / 7) % rule.interval === 0 &&
                    rule.weekdays.includes(weekday)
                  : months % rule.interval === 0 && date.getUTCDate() === origin.getUTCDate();
        if (!matches) continue;
        try {
            const startsAt = timestamp(`${text}T${rule.time}`);
            if (startsAt > now) dates.push({ date: text, startsAt });
        } catch {
            errors.push(`${text}: choose a time outside the daylight-saving change.`);
        }
    }
    return { dates, errors };
}
