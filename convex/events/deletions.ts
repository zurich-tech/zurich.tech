import { v } from "convex/values";
import { query, mutation, type QueryCtx } from "../_generated/server";
import { requireTeam } from "../auth/access";
import type { Id } from "../_generated/dataModel";

const id = v.union(v.id("submissions"), v.id("series"), v.id("schedules"));
type Target = Id<"submissions"> | Id<"series"> | Id<"schedules">;

/** Explain why an editor record cannot be deleted. */
export const reason = query({
    args: { id },
    handler: async (ctx, args) => {
        await requireTeam(ctx);
        return await deletionReason(ctx, args.id);
    },
});

/** Delete an unused record after checking its current references. */
export const remove = mutation({
    args: { id },
    handler: async (ctx, args) => {
        await requireTeam(ctx);
        const reason = await deletionReason(ctx, args.id);
        if (reason) throw new Error(reason);

        // delete event content together with all of its editable revisions
        const draftId = ctx.db.normalizeId("submissions", args.id);
        const draft = draftId ? await ctx.db.get(draftId) : null;
        if (draft?.eventId) {
            for (const table of ["sessions", "speakers", "photos", "submissions"] as const) {
                const rows = await ctx.db
                    .query(table)
                    .filter((q) => q.eq(q.field("eventId"), draft.eventId))
                    .collect();
                for (const row of rows) {
                    if (table === "speakers") {
                        const links = await ctx.db
                            .query("links")
                            .withIndex("by_owner", (q) =>
                                q.eq("ownerId", row._id as Id<"speakers">),
                            )
                            .collect();
                        for (const link of links) await ctx.db.delete(link._id);
                    }
                    await ctx.db.delete(row._id);
                }
            }
            const links = await ctx.db
                .query("links")
                .withIndex("by_owner", (q) => q.eq("ownerId", draft.eventId!))
                .collect();
            for (const link of links) await ctx.db.delete(link._id);
            await ctx.db.delete(draft.eventId);
        } else {
            await ctx.db.delete(args.id);
        }
    },
});

/** Retain records with participation, communication or recurrence history. */
async function deletionReason(ctx: QueryCtx, id: Target): Promise<string | null> {
    const row = await ctx.db.get(id);
    if (!row) return "Record not found.";

    // series remain referenced by events, drafts and schedules
    if (ctx.db.normalizeId("series", id)) {
        for (const table of ["events", "submissions", "schedules"] as const) {
            if (
                await ctx.db
                    .query(table)
                    .filter((q) => q.eq(q.field("seriesId"), id))
                    .first()
            )
                return `This series has ${table === "submissions" ? "drafts" : table}.`;
        }
        if ("announcedAt" in row && row.announcedAt) return "This series has been announced.";
    }

    // sequence counters preserve evidence even after an unused occurrence is removed
    if (ctx.db.normalizeId("schedules", id)) {
        if (
            ("nextNumber" in row && (row.nextNumber ?? 1) > 1) ||
            (await ctx.db
                .query("events")
                .filter((q) => q.eq(q.field("scheduleId"), id))
                .first())
        )
            return "This schedule has generated events. Pause it instead.";
    }

    // all registration statuses and pending mail prevent deletion
    if (ctx.db.normalizeId("submissions", id) && "eventId" in row && row.eventId) {
        const event = await ctx.db.get(row.eventId);
        if (!event || event.status !== "draft") return "Unpublish this event before deleting it.";
        if (event.startsAt <= Date.now()) return "Past events cannot be deleted.";
        if (event.scheduleId) return "This event belongs to a schedule. Cancel it instead.";
        for (const table of [
            "registrations",
            "attendances",
            "feedback",
            "deliveries",
            "verifications",
        ] as const) {
            if (
                await ctx.db
                    .query(table)
                    .filter((q) => q.eq(q.field("eventId"), event._id))
                    .first()
            )
                return `This event has ${table === "deliveries" ? "email history" : table === "verifications" ? "registration requests" : table}.`;
        }
        if (event.announcedAt || event.reminderStartsAt) return "This event has email history.";
    }
    return null;
}
