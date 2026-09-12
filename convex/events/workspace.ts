import { calendarRow } from "./queries";
import { eventPlace } from "./place";
import { readTeam } from "../members/team";
import { query } from "../_generated/server";
import { requireTeam } from "../auth/access";

/** Read the team's events and account controls. */
export const events = query({
    args: {},
    handler: async (ctx) => {
        const viewer = await requireTeam(ctx);
        const submissions = await ctx.db.query("submissions").collect();
        const accounts = await ctx.db.query("accounts").collect();
        const people = await Promise.all(
            accounts
                .filter((account) => account.status === "active")
                .map(async (account) => {
                    const profile = await ctx.db.get(account.memberId);
                    if (!profile) throw new Error("Account member is missing.");
                    const emails = await ctx.db
                        .query("emails")
                        .withIndex("by_member", (q) => q.eq("memberId", account.memberId))
                        .collect();

                    return {
                        id: account._id,
                        name: profile.name,
                        email: emails.find((email) => email.isPrimary)?.email,
                        isTeam: account.isTeam,
                        isSelf: account._id === viewer._id,
                    };
                }),
        );

        // show published events without an editable revision separately
        const events = await ctx.db.query("events").collect();
        const revised = new Set(submissions.map((item) => item.eventId));
        const published = events
            .filter((item) => !revised.has(item._id))
            .sort((a, b) => b.startsAt - a.startsAt);
        // hydrate linked venue addresses for existing editable revisions
        const revisions = await Promise.all(
            submissions.map(async (draft) => {
                const event = events.find((event) => event._id === draft.eventId);
                const revision = { ...draft, summary: draft.summary ?? event?.summary };
                if (!event || draft.address !== undefined || draft.location !== event.location)
                    return revision;
                const place = await eventPlace(ctx, event);

                return { ...revision, ...place };
            }),
        );
        // expose aggregate registration counts only to the event management table
        const counts = await Promise.all(
            events.map(async (event) => {
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
        const digest = await ctx.db.query("digests").unique();

        return {
            submissions: revisions.sort((a, b) => b.updatedAt - a.updatedAt),
            people,
            viewerId: viewer.memberId,
            organisers: (await readTeam(ctx))
                .map((member) => ({ id: member._id, name: member.name }))
                .sort((a, b) => a.name.localeCompare(b.name)),
            published,
            counts,
            digest,
            statuses: events.map((event) => ({
                id: event._id,
                status: event.status,
                confirmation: event.confirmation,
                confirmedAt: event.confirmedAt,
                approvedAt: event.approvedAt,
                scheduleId: event.scheduleId,
            })),
        };
    },
});

/** Read unpublished planning entries without exposing them to public queries. */
export const planning = query({
    args: {},
    handler: async (ctx) => {
        await requireTeam(ctx);
        const events = await ctx.db.query("events").collect();
        const submissions = await ctx.db.query("submissions").collect();
        const drafts = submissions.filter(
            (draft) =>
                !draft.eventId ||
                events.find((event) => event._id === draft.eventId)?.status === "draft",
        );
        const revised = new Set(drafts.map((draft) => draft.eventId));
        const unpublished = await Promise.all(
            events
                .filter((event) => event.status === "draft" && !revised.has(event._id))
                .map(async (event) => ({
                    ...(await calendarRow(ctx, event)),
                    href: `/submit?event=${event._id}`,
                })),
        );

        return [
            ...unpublished,
            ...drafts.map((draft) => ({
                id: draft._id,
                href: `/submit?edit=${draft._id}`,
                slug: draft.slug,
                title: draft.title,
                summary: draft.summary,
                startsAt: draft.startsAt,
                location: draft.location,
                tags: draft.topics,
                seriesId: draft.seriesId,
                status: "draft" as const,
                confirmation: draft.confirmation,
                confirmedAt: undefined,
                registrationKind: draft.registration.kind,
                capacity:
                    draft.registration.kind === "none" ? undefined : draft.registration.capacity,
                rsvpCount: undefined,
                waitlistCount: undefined,
            })),
        ];
    },
});
