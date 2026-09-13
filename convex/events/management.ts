import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireWorkspace, scopedEvents, scopedRevisions } from "../auth/grants";
import { allows } from "../auth/permissions";
import { readTeam } from "../members/team";
import { eventPlace } from "./place";

/** Read only assigned content; account management and newsletters load separately. */
export const workspace = query({
    args: { editor: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const access = await requireWorkspace(ctx);
        const events = await scopedEvents(ctx, access);
        const drafts = await scopedRevisions(ctx, access, events);
        const byId = new Map(events.map((event) => [event._id, event]));
        const revised = new Set(drafts.map((draft) => draft.eventId));
        const submissions = await Promise.all(
            drafts.map(async (draft) => {
                const event = byId.get(draft.eventId!);
                const revision = { ...draft, summary: draft.summary ?? event?.summary };
                if (!event || draft.address !== undefined || draft.location !== event.location)
                    return revision;
                return { ...revision, ...(await eventPlace(ctx, event)) };
            }),
        );
        const counts = await Promise.all(
            (args.editor ? [] : events).map(async (event) => {
                const rows = await ctx.db
                    .query("registrations")
                    .withIndex("by_event", (q) => q.eq("eventId", event._id))
                    .collect();
                return {
                    eventId: event._id,
                    confirmed:
                        event.registration.kind === "native" || rows.length
                            ? rows.filter((row) => row.status === "going").length
                            : undefined,
                    waitlist: rows.filter((row) => row.status === "waitlist").length,
                    pending: rows.filter((row) => row.status === "pending").length,
                };
            }),
        );
        return {
            submissions: submissions.sort((a, b) => b.updatedAt - a.updatedAt),
            published: events
                .filter((event) => !revised.has(event._id))
                .sort((a, b) => b.startsAt - a.startsAt),
            viewerId: access.account.memberId,
            organisers: (await readTeam(ctx))
                .map((member) => ({ id: member._id, name: member.name }))
                .sort((a, b) => a.name.localeCompare(b.name)),
            isAdmin: access.isAdmin,
            organiserEventIds: events
                .filter((event) =>
                    allows(access, { eventId: event._id, seriesId: event.seriesId }, "organiser"),
                )
                .map((event) => event._id),
            counts,
            statuses: events.map((event) => ({
                id: event._id,
                seriesId: event.seriesId,
                status: event.status,
                confirmation: event.confirmation,
                confirmedAt: event.confirmedAt,
                approvedAt: event.approvedAt,
                scheduleId: event.scheduleId,
            })),
        };
    },
});
