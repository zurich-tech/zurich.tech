import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

/** The daily bulk ceiling of a sender without reputation. */
export const initialCeiling = 500;

/** The highest daily bulk ceiling. */
export const maximumCeiling = 10000;

/** The hours over which each day's ceiling is spread. */
const sendingHours = 8;

/** Shared bulk usage for the current sending day. */
type Usage = {
    /** Zurich calendar day of the recorded attempts. */
    date: string;
    /** Attempts consumed on that day. */
    count: number;
    /** Reviewed daily pace. */
    ceiling: number;
};

/** Reset daily usage without increasing the reviewed sending pace. */
export function advance(usage: Usage, now: number) {
    const date = sendingDate(now);
    if (usage.date === date) return { date, count: usage.count, ceiling: usage.ceiling };

    return { date, count: 0, ceiling: usage.ceiling };
}

/** Reduce the reviewed pace after a health stop, never increasing a lower custom pace. */
export function halve(ceiling: number) {
    return Math.max(1, Math.floor(ceiling / 2));
}

/** Use the explicit hourly limit, retaining eight-hour pacing for older quotas. */
export function hourly(ceiling: number, limit?: number) {
    return limit ?? Math.ceil(ceiling / sendingHours);
}

/** Recognise only the current scheduler-created edition, never arbitrary weekly campaigns. */
export function scheduledNewsletter(
    campaign: Doc<"campaigns"> | null | undefined,
    lastWeek: string | undefined,
    now: number,
) {
    return !!(
        lastWeek &&
        campaign?.category === "weekly" &&
        campaign.key === `digest:${lastWeek}` &&
        campaign.expiresAt !== undefined &&
        campaign.expiresAt > now
    );
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
