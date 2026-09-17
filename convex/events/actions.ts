import { isAnnounced } from "./mail";
import { confirmationDecision, isTentative } from "./conditions";
import { receivesAnnouncement } from "../mail/events";
import { v, type Infer } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireEvent, requireRevision } from "../auth/grants";
import { submissionFields } from "./fields";
import { notificationChanges } from "./changes";
import { eventPlace } from "./place";
import { registrations, waitingForSeats } from "./registrations";

/** Event transitions that require confirmation. */
export const action = v.union(
    v.literal("publish"),
    v.literal("unpublish"),
    v.literal("cancel"),
    v.literal("approve"),
    v.literal("confirm"),
);
/** Editable event content used to preview publication. */
const fields = v.object(submissionFields);

/** Count notifications and detect concurrent event changes before confirmation. */
export async function eventAction(
    ctx: QueryCtx,
    event: Doc<"events"> | null,
    intent: Infer<typeof action>,
    proposed?: Infer<typeof fields>,
    announce = false,
) {
    // Revisions written before visibility existed must not expose an unlisted event.
    if (proposed && event && proposed.visibility === undefined)
        proposed = { ...proposed, visibility: event.visibility };

    const now = Date.now();
    if (intent !== "publish" && !event) throw new Error("Event not found.");
    if (event?.status === "cancelled")
        throw new Error("This event is cancelled. Duplicate it to create a new event.");
    if (intent === "publish" && !proposed) throw new Error("Event fields are required.");
    if (intent === "unpublish" && event?.status === "draft")
        throw new Error("This event is already unpublished.");

    // apply the same subscription and suppression rules as delivery
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const suppressed = new Set(
        subscriptions.filter((row) => row.status === "suppressed").map((row) => row.email),
    );
    const rows = event ? await registrations(ctx, event) : [];
    const active = rows.filter(
        (row) =>
            row.email &&
            row.status !== "cancelled" &&
            row.status !== "declined" &&
            !suppressed.has(row.email),
    );
    const recipients = new Set<string>();
    let announcements = 0;
    let updates = 0;
    let changes: ReturnType<typeof notificationChanges> = [];
    let promotions = 0;
    const confirms =
        event &&
        isTentative(event) &&
        (intent === "confirm" ||
            (intent === "approve" &&
                confirmationDecision({ ...event, approvedAt: now }, rows, now) === "confirmed"));
    if ((intent === "cancel" || confirms) && event!.startsAt > now) {
        updates = active.length;
        for (const row of active) recipients.add(row.email);
    }
    if (intent === "publish" && proposed) {
        if (announce) {
            if (proposed.visibility === "unlisted")
                throw new Error("Unlisted events cannot be announced to subscribers.");
            if (proposed.startsAt <= now) throw new Error("Only upcoming events can be announced.");
            if (event && (await isAnnounced(ctx, event)))
                throw new Error("This event has already been announced.");
            const subscribers = subscriptions.filter((row) => receivesAnnouncement(row, now));
            announcements = subscribers.length;
            for (const row of subscribers) recipients.add(row.email);
        }
        if (event) {
            const place = await eventPlace(ctx, event);
            changes = notificationChanges({ ...event, ...place }, proposed);
            if (changes.length && (event.startsAt > now || proposed.startsAt > now)) {
                updates = active.length;
                for (const row of active) recipients.add(row.email);
            }
            const waiting = waitingForSeats(
                {
                    ...proposed,
                    confirmedAt: event.confirmedAt,
                    status: proposed.startsAt > now ? "scheduled" : "finished",
                },
                rows,
            );
            const promoted = waiting.filter((row) => !suppressed.has(row.email));
            promotions = promoted.length;
            for (const row of promoted) recipients.add(row.email);

            // include confirmation notices triggered by a newly available seat
            const allocated = new Set(waiting.map((row) => row._id));
            const after = rows.map((row) =>
                allocated.has(row._id) ? { ...row, status: "going" } : row,
            );
            if (
                proposed.startsAt > now &&
                confirmationDecision({ ...event, confirmation: proposed.confirmation }, after, now)
            ) {
                updates += active.length;
                for (const row of active) recipients.add(row.email);
            }
        }
    }

    const emails = announcements + updates + promotions;
    return {
        title: proposed?.title ?? event!.title,
        visibility: proposed?.visibility ?? event?.visibility ?? "public",
        visibilityChanged:
            !!event &&
            !!proposed &&
            (event.visibility ?? "public") !== (proposed.visibility ?? "public"),
        emails,
        followUp: proposed?.followUp?.isEnabled
            ? {
                  delayHours: proposed.followUp.delayHours,
                  isAttendanceRequired: !!proposed.checkIn?.isEnabled,
                  currentRegistrations: rows.filter((row) => row.status === "going").length,
              }
            : undefined,
        recipients: recipients.size,
        announcements,
        updates,
        changes,
        promotions,
        receipt: JSON.stringify([
            intent,
            proposed,
            announce,
            [...recipients].sort(),
            event?._id,
            event?.updatedAt,
            event?.status,
            event?.confirmation,
            event?.confirmedAt,
            event?.approvedAt,
            announcements,
            updates,
            promotions,
        ]),
    };
}

/** Preview recipient counts without saving changes or sending mail. */
export const preview = query({
    args: {
        id: v.optional(v.id("submissions")),
        eventId: v.optional(v.id("events")),
        action,
        fields: v.optional(fields),
        announce: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const draft = args.id ? await ctx.db.get(args.id) : null;
        if (args.id && !draft) throw new Error("Draft not found.");
        const id = args.eventId ?? draft?.eventId;
        const event = id ? await ctx.db.get(id) : null;
        if (id && !event) throw new Error("Event not found.");
        if (id) await requireEvent(ctx, id);
        else
            await requireRevision(
                ctx,
                draft,
                args.fields?.seriesId ?? draft?.seriesId,
                "organiser",
            );

        return await eventAction(ctx, event, args.action, args.fields, args.announce);
    },
});

/** Require a new confirmation when the event or recipient counts have changed. */
export function confirmAction(actual: { receipt: string }, expected: string) {
    if (actual.receipt !== expected)
        throw new Error("The event or email recipients changed. Please review and confirm again.");
}
