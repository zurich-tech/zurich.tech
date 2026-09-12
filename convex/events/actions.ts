import { receivesAnnouncement } from "../mail/events";
import { v, type Infer } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireTeam } from "../auth/access";
import { submissionFields } from "./fields";
import { eventPlace } from "./place";
import { registrations, waitingForSeats } from "./registrations";

/** Event transitions that require confirmation. */
export const action = v.union(v.literal("publish"), v.literal("unpublish"), v.literal("cancel"));
/** Editable event content used to preview publication. */
const fields = v.object(submissionFields);

/** Count notifications and detect concurrent event changes before confirmation. */
export async function eventAction(
    ctx: QueryCtx,
    event: Doc<"events"> | null,
    intent: Infer<typeof action>,
    proposed?: Infer<typeof fields>,
) {
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
    let promotions = 0;
    if (intent === "cancel" && event!.startsAt > now) {
        updates = active.length;
        for (const row of active) recipients.add(row.email);
    }
    if (intent === "publish" && proposed) {
        if (!event && proposed.startsAt > now) {
            const subscribers = subscriptions.filter((row) => receivesAnnouncement(row, now));
            announcements = subscribers.length;
            for (const row of subscribers) recipients.add(row.email);
        }
        if (event) {
            const place = await eventPlace(ctx, event);
            const changed =
                event.startsAt !== proposed.startsAt ||
                event.endsAt !== proposed.endsAt ||
                place.location !== proposed.location ||
                place.address !== (proposed.address ?? "");
            if (changed && (event.startsAt > now || proposed.startsAt > now)) {
                updates = active.length;
                for (const row of active) recipients.add(row.email);
            }
            const promoted = waitingForSeats(
                { ...proposed, status: proposed.startsAt > now ? "scheduled" : "finished" },
                rows,
            ).filter((row) => !suppressed.has(row.email));
            promotions = promoted.length;
            for (const row of promoted) recipients.add(row.email);
        }
    }

    const emails = announcements + updates + promotions;
    return {
        emails,
        recipients: recipients.size,
        announcements,
        updates,
        promotions,
        receipt: JSON.stringify([
            intent,
            recipients.size,
            event?._id,
            event?.updatedAt,
            event?.status,
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
    },
    handler: async (ctx, args) => {
        await requireTeam(ctx);
        const draft = args.id ? await ctx.db.get(args.id) : null;
        if (args.id && !draft) throw new Error("Draft not found.");
        const id = args.eventId ?? draft?.eventId;
        const event = id ? await ctx.db.get(id) : null;
        if (id && !event) throw new Error("Event not found.");

        return await eventAction(ctx, event, args.action, args.fields);
    },
});

/** Require a new confirmation when the event or recipient counts have changed. */
export function confirmAction(actual: { receipt: string }, expected: string) {
    if (actual.receipt !== expected)
        throw new Error("The event or email recipients changed. Please review and confirm again.");
}
