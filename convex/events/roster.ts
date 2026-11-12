import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { isTentative } from "./conditions";
import * as statistics from "../statistics/registrations";

/** Editable registration fields. */
type Registration = Omit<Doc<"registrations">, "_id" | "_creationTime">;

/** Insert a registration with its calendar and history counts. */
export async function insertRegistration(ctx: MutationCtx, values: Registration) {
    const id = await ctx.db.insert("registrations", values);
    await statistics.update(ctx, null, values);

    return id;
}

/** Update a registration and every affected aggregate in the same transaction. */
export async function updateRegistration(
    ctx: MutationCtx,
    id: Id<"registrations">,
    values: Partial<Registration>,
) {
    const previous = await ctx.db.get(id);
    if (!previous) throw new Error("registration is missing");
    await ctx.db.patch(id, values);
    await statistics.update(ctx, previous, { ...previous, ...values });
}

/** Read an event's small, indexed attendee set. */
export async function registrations(ctx: Pick<QueryCtx, "db">, event: Doc<"events">) {
    return await ctx.db
        .query("registrations")
        .withIndex("by_event", (range) => range.eq("eventId", event._id))
        .collect();
}

/** Select approved waitlisted registrations that fit the event's open seats. */
export function waitingForSeats(
    event: Pick<
        Doc<"events">,
        "registration" | "status" | "startsAt" | "confirmation" | "confirmedAt"
    >,
    rows: Doc<"registrations">[],
) {
    const policy = event.registration;
    const now = Date.now();
    if (
        (isTentative(event) && event.confirmation!.decidesAt <= now) ||
        policy.kind !== "native" ||
        event.status !== "scheduled" ||
        event.startsAt <= now ||
        (policy.closesAt !== undefined && policy.closesAt <= now)
    )
        return [];
    const confirmed = rows.filter((row) => row.status === "going").length;
    const available =
        policy.capacity === null ? rows.length : Math.max(0, policy.capacity - confirmed);

    return rows
        .filter((row) => row.status === "waitlist" && row.approvedAt !== undefined)
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, available);
}
