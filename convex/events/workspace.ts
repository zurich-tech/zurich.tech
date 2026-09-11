import { query } from "../_generated/server";
import { requireAccount } from "../auth/access";

/** Read only the workspace records the current account owns or moderates. */
export const events = query({
    args: {},
    handler: async (ctx) => {
        // identify the account before selecting owned records
        const viewer = await requireAccount(ctx);
        const submissions = viewer.isTeam
            ? await ctx.db.query("submissions").collect()
            : await ctx.db
                  .query("submissions")
                  .withIndex("by_owner", (range) => range.eq("ownerId", viewer.memberId))
                  .collect();

        // expose publishing controls only to the team
        const members = viewer.isTeam ? await ctx.db.query("accounts").collect() : [];
        const people = await Promise.all(
            members.map(async (member) => {
                const profile = await ctx.db.get(member.memberId);
                if (!profile) throw new Error("Account member is missing.");

                return {
                    id: member._id,
                    name: profile.name,
                    canPublish: member.canPublish === true,
                };
            }),
        );

        // expose imported published events that do not yet have an editable revision
        const events = viewer.isTeam
            ? await ctx.db.query("events").collect()
            : await ctx.db
                  .query("events")
                  .withIndex("by_owner", (q) => q.eq("ownerId", viewer.memberId))
                  .collect();
        const revised = new Set(submissions.map((item) => item.eventId));
        const published = events
            .filter((item) => !revised.has(item._id))
            .sort((a, b) => b.startsAt - a.startsAt);
        const digest = viewer.isTeam ? await ctx.db.query("digests").unique() : null;

        return {
            viewer: { isTeam: viewer.isTeam, canPublish: viewer.canPublish },
            submissions: submissions.sort((a, b) => b.updatedAt - a.updatedAt),
            people,
            published,
            digest,
        };
    },
});
