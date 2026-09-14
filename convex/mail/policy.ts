import { ConvexError } from "convex/values";
/** Daily and hourly ceilings for each active sending day. */
export const profiles = {
    new: {
        daily: [150, 250, 400, 700, 1000, 1500, 2000],
        hourly: [25, 25, 40, 50, 75, 100, 150],
    },
    established: {
        daily: [1000, 2500, 5000, 5000, 7500, 7500, 10000],
        hourly: [100, 300, 600, 800, 1000, 1500, 2000],
    },
    complete: { daily: [10000], hourly: [2000] },
};

/** Resolve a profile without increasing limits merely because time passed. */
export function ceilings(profile: keyof typeof profiles, day: number) {
    const values = profiles[profile];
    const index = Math.min(Math.max(0, day), values.daily.length - 1);
    return { daily: values.daily[index], hourly: values.hourly[index] };
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
