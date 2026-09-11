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
        const digest = await ctx.db.query("digests").unique();

        // offer team profiles and retain organisers already attached to events
        const organisation = await ctx.db
            .query("organisations")
            .withIndex("by_slug", (q) => q.eq("slug", "zurich-tech"))
            .unique();
        const roles = organisation
            ? await ctx.db
                  .query("roles")
                  .withIndex("by_organisation", (q) => q.eq("organisationId", organisation._id))
                  .collect()
            : [];
        const organiserIds = new Set([
            ...roles.filter((role) => role.status === "active").map((role) => role.memberId),
            ...accounts
                .filter((account) => account.status === "active" && account.isTeam)
                .map((account) => account.memberId),
        ]);
        const assignedIds = new Set(
            [...events, ...submissions].flatMap((event) => event.organiserIds ?? [event.ownerId]),
        );

        return {
            submissions: submissions.sort((a, b) => b.updatedAt - a.updatedAt),
            people,
            viewerId: viewer.memberId,
            organisers: (await ctx.db.query("members").collect())
                .filter(
                    (member) =>
                        (member.status === "active" || member.status === "imported") &&
                        (organiserIds.has(member._id) || assignedIds.has(member._id)),
                )
                .map((member) => ({
                    id: member._id,
                    name: member.name,
                    isTeam: organiserIds.has(member._id),
                }))
                .sort((a, b) => a.name.localeCompare(b.name)),
            published,
            digest,
            statuses: events.map((event) => ({ id: event._id, status: event.status })),
        };
    },
});
