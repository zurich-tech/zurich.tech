import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { date } from "./history";

/** Registration fields that determine calendar counts and signup history. */
type Registration = Pick<Doc<"registrations">, "eventId" | "status" | "createdAt">;

/** Update calendar totals and dated counts atomically with a registration change. */
export async function update(
    ctx: MutationCtx,
    before: Registration | null,
    after: Registration | null,
) {
    // group removals and additions so a status change never touches historical signup totals
    const events = new Set([before?.eventId, after?.eventId]);
    for (const eventId of events) {
        if (!eventId) continue;
        const previous = before?.eventId === eventId ? before : null;
        const current = after?.eventId === eventId ? after : null;
        const total = Number(!!current) - Number(!!previous);
        const going = Number(current?.status === "going") - Number(previous?.status === "going");
        const waitlist =
            Number(current?.status === "waitlist") - Number(previous?.status === "waitlist");
        if (total || going || waitlist) {
            const row = await ctx.db
                .query("eventCounts")
                .withIndex("by_event", (query) => query.eq("eventId", eventId))
                .unique();
            const values = {
                eventId,
                total: (row?.total ?? 0) + total,
                going: (row?.going ?? 0) + going,
                waitlist: (row?.waitlist ?? 0) + waitlist,
            };
            if (
                values.total < 0 ||
                values.going < 0 ||
                values.waitlist < 0 ||
                values.going + values.waitlist > values.total
            )
                throw new Error("registration counts require a backfill");
            if (row) await ctx.db.patch(row._id, values);
            else await ctx.db.insert("eventCounts", values);
        }

        // preserve the existing definition: all registration records count in signup history
        const previousDate = previous ? date(previous.createdAt) : undefined;
        const currentDate = current ? date(current.createdAt) : undefined;
        if (previousDate === currentDate) continue;
        for (const [day, change] of [
            [previousDate, -1],
            [currentDate, 1],
        ] as const) {
            if (!day) continue;
            const row = await ctx.db
                .query("registrationDays")
                .withIndex("by_event_date", (query) => query.eq("eventId", eventId).eq("date", day))
                .unique();
            const count = (row?.count ?? 0) + change;
            if (count < 0) throw new Error("registration history requires a backfill");
            if (!count && row) await ctx.db.delete(row._id);
            else if (row) await ctx.db.patch(row._id, { count });
            else await ctx.db.insert("registrationDays", { eventId, date: day, count });
        }
    }
}
