import { ConvexError } from "convex/values";

/** The daily bulk ceiling of a sender without reputation. */
export const initialCeiling = 300;

/** The highest daily bulk ceiling. */
export const maximumCeiling = 10000;

/** The hours over which each day's ceiling is spread. */
const sendingHours = 8;

/** Shared bulk usage for the current sending day. */
type Usage = { date: string; count: number; ceiling: number; stoppedOn?: string };

/** Advance usage to the current sending day, doubling the ceiling after an earned day. */
export function advance(usage: Usage, now: number) {
    const date = sendingDate(now);
    if (usage.date === date) return { date, count: usage.count, ceiling: usage.ceiling };

    // earn growth only by using at least half the ceiling without a health stop
    const isUsed = usage.count * 2 >= usage.ceiling;
    const isHealthy = !usage.stoppedOn || usage.stoppedOn < usage.date;
    const ceiling =
        isUsed && isHealthy ? Math.min(usage.ceiling * 2, maximumCeiling) : usage.ceiling;

    return { date, count: 0, ceiling };
}

/** Halve the ceiling after a health stop, never below the initial ceiling. */
export function halve(ceiling: number) {
    return Math.max(initialCeiling, Math.floor(ceiling / 2));
}

/** Spread a daily ceiling evenly across the sending hours. */
export function hourly(ceiling: number) {
    return Math.ceil(ceiling / sendingHours);
}

/** Only newsletters and announcements use the bulk queue. */
export function isBulk(category?: string) {
    return category === "weekly" || category === "announcement" || category === "campaign";
}

/** A configured recipient lock is enforced independently of bulk controls. */
export function recipientsLocked() {
    return process.env.MAIL_RECIPIENTS !== undefined;
}

/** Keep tests and development mail within explicitly allowed recipients. */
export function recipientAllowed(email: string) {
    return (
        !recipientsLocked() ||
        process.env
            .MAIL_RECIPIENTS!.split(",")
            .some((value) => value.trim().toLowerCase() === email.trim().toLowerCase())
    );
}

/** Reject email-dependent requests before creating state the recipient cannot confirm. */
export function requireRecipient(email: string) {
    if (!recipientAllowed(email))
        throw new ConvexError(
            "Test mode: No email was sent. Use an approved test address or try again when Test mode is off.",
        );
}

/** Explicit audience sends must not appear successful while sending is locked. */
export function requireAudienceDelivery() {
    if (recipientsLocked())
        throw new ConvexError(
            "Test mode: audience email delivery is locked. Turn off Test mode before sending.",
        );
}

/** Use local calendar days while keeping hourly pacing continuous at midnight. */
export function sendingDate(now: number) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
}
