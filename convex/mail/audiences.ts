import type { Doc } from "../_generated/dataModel";
import { isTentative } from "../events/conditions";
import type { QueryCtx } from "../_generated/server";
import type { Audience, Category, Recipient } from "./model";

/** Resolve a supported audience, respecting purpose-specific preferences and suppression. */
export async function select(ctx: QueryCtx, audience: Audience, category: Category) {
    const candidates =
        audience.kind === "subscribers"
            ? await ctx.db
                  .query("subscriptions")
                  .withIndex("by_status", (q) => q.eq("status", "subscribed"))
                  .collect()
            : await ctx.db
                  .query("registrations")
                  .withIndex("by_event", (q) => q.eq("eventId", audience.eventId))
                  .collect();
    const recipients: Recipient[] = [];
    const emails = new Set<string>();
    for (const row of candidates) {
        // apply registration membership separately from email consent
        if ("eventId" in row && audience.kind === "registrations") {
            if (row.status === "cancelled" || row.status === "declined") continue;
            if (
                (audience.status === "going" || audience.status === "waitlist") &&
                row.status !== audience.status
            )
                continue;
            if (
                audience.status === "attended" &&
                !(await ctx.db
                    .query("attendances")
                    .withIndex("by_registrationId", (q) => q.eq("registrationId", row._id))
                    .unique())
            )
                continue;
        }
        const subscription =
            "eventId" in row
                ? await ctx.db
                      .query("subscriptions")
                      .withIndex("by_email", (q) => q.eq("email", row.email))
                      .unique()
                : row;
        if (subscription?.status === "suppressed") continue;
        if (
            audience.kind === "subscribers" &&
            (!subscription?.token || subscription.status !== "subscribed")
        )
            continue;
        if (category === "weekly" && subscription?.weekly === false) continue;
        if (category === "announcement" && subscription?.announcements === false) continue;
        if (
            category === "campaign" &&
            subscription?.weekly === false &&
            subscription?.announcements === false
        )
            continue;
        if (category === "reminder" && subscription?.reminders === false) continue;
        if (
            category === "followup" &&
            (subscription?.followUps === false ||
                (subscription?.status === "unsubscribed" && subscription.followUps !== true))
        )
            continue;

        // preserve one source identity per email address
        const email = row.email.trim().toLowerCase();
        if (emails.has(email)) continue;
        emails.add(email);
        recipients.push(row._id);
    }
    return { recipients, excluded: candidates.length - recipients.length };
}

/** Rank eligible recipients by registration recency, distinct events and genuine signup activity. */
export async function rank(ctx: QueryCtx, recipients: Recipient[], now = Date.now()) {
    // scan each bounded community table once, independent of audience size
    const registrations = await ctx.db.query("registrations").collect();
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const events = new Map(
        (await ctx.db.query("events").collect()).map((event) => [event._id, event]),
    );
    const sources = new Map<string, Doc<"registrations"> | Doc<"subscriptions">>(
        [...registrations, ...subscriptions].map((row) => [row._id, row]),
    );

    // match historical registrations by email even when no account existed at import time
    const identities = new Map<string, Doc<"registrations">[]>();
    for (const registration of registrations) {
        if (registration.status === "cancelled" || registration.status === "declined") continue;
        const keys: string[] = [registration.email.trim().toLowerCase()];
        if (registration.memberId) keys.push(registration.memberId);

        // index both identities so account creation does not discard historical activity
        for (const key of keys) {
            const rows = identities.get(key) ?? [];
            rows.push(registration);
            identities.set(key, rows);
        }
    }

    // use explicit recency bands, not an opaque weighted score
    const ranked = recipients.map((id) => {
        const source = sources.get(id);
        if (!source) throw new Error("Campaign recipient no longer exists.");

        // combine registrations across the current address and linked member
        const email = source.email.trim().toLowerCase();
        const rows = [
            ...(identities.get(email) ?? []),
            ...(source.memberId ? (identities.get(source.memberId) ?? []) : []),
        ];

        // count each eligible event once and cap imported activity at its event date
        const distinct = new Set<string>();
        let latest = 0;
        for (const row of rows) {
            const event = events.get(row.eventId);
            if (!event) throw new Error("Registration event no longer exists.");
            if (event.status === "cancelled" || event.status === "draft") continue;
            distinct.add(row.eventId);
            latest = Math.max(latest, Math.min(row.createdAt, event.startsAt, now));
        }

        // imported observations must not masquerade as fresh subscriber interest
        const subscribed =
            "eventId" in source
                ? []
                : (source.history ?? [])
                      .filter((entry) => entry.status === "subscribed" && !entry.isEstimated)
                      .map((entry) => entry.at);
        const verified = "eventId" in source ? 0 : (source.verifiedAt ?? 0);
        const activity = Math.min(now, Math.max(latest, verified, ...subscribed));

        // group recent registrants before dormant contacts
        const cohort = !distinct.size
            ? 3
            : latest >= now - 90 * 86400000
              ? 0
              : latest >= now - 365 * 86400000
                ? 1
                : 2;

        return { id, email, cohort, events: distinct.size, latest, activity };
    });

    return ranked.sort(
        (left, right) =>
            left.cohort - right.cohort ||
            right.events - left.events ||
            right.activity - left.activity ||
            left.email.localeCompare(right.email) ||
            left.id.localeCompare(right.id),
    );
}

/** Recheck the recipient, admission and attendance policy before delivery. */
export async function receivesFollowUp(
    ctx: QueryCtx,
    event: Doc<"events">,
    row: Doc<"registrations">,
) {
    if (
        !event.followUp?.isEnabled ||
        !event.endsAt ||
        event.endsAt > Date.now() ||
        event.status === "cancelled" ||
        event.status === "draft" ||
        isTentative(event) ||
        row.status !== "going" ||
        !row.token
    )
        return false;
    const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_email", (q) => q.eq("email", row.email))
        .unique();
    if (
        subscription?.status === "suppressed" ||
        subscription?.followUps === false ||
        (subscription?.status === "unsubscribed" && subscription.followUps !== true)
    )
        return false;
    if (!event.checkIn?.isEnabled) return true;
    return !!(await ctx.db
        .query("attendances")
        .withIndex("by_registrationId", (q) => q.eq("registrationId", row._id))
        .unique());
}
