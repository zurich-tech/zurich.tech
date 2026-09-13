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
