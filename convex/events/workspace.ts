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

        return {
            submissions: submissions.sort((a, b) => b.updatedAt - a.updatedAt),
            people,
            published,
            digest,
        };
    },
});
