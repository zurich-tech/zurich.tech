import { paidTerm } from "./payments";
import { jobExpiry } from "./jobs";
import { query } from "./_generated/server";
import { requireAccount } from "./access";

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
                  .withIndex("by_owner", (range) => range.eq("ownerMemberId", viewer.memberId))
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
                  .withIndex("by_ownerMemberId", (q) => q.eq("ownerMemberId", viewer.memberId))
                  .collect();
        const revised = new Set(submissions.map((item) => item.eventId));
        const published = events
            .filter((item) => !revised.has(item._id))
            .sort((a, b) => b.startsAt - a.startsAt);
        const digest = viewer.isTeam ? await ctx.db.query("digest").unique() : null;

        return {
            viewer: { isTeam: viewer.isTeam, canPublish: viewer.canPublish },
            submissions: submissions.sort((a, b) => b.updatedAt - a.updatedAt),
            people,
            published,
            digest,
        };
    },
});

/** Read the current employer's company, job and sponsorship workspace. */
export const employer = query({
    args: {},
    handler: async (ctx) => {
        // identify the account before selecting owned records
        const viewer = await requireAccount(ctx);
        const organisations = await ctx.db.query("organisations").collect();
        const companies = organisations.filter(
            (row) => viewer.isTeam || row.ownerMemberId === viewer.memberId,
        );

        // read jobs belonging to the visible companies
        const jobs = (
            await Promise.all(
                companies.map((company) =>
                    ctx.db
                        .query("jobs")
                        .withIndex("by_company", (q) => q.eq("organisationId", company._id))
                        .collect(),
                ),
            )
        ).flat();

        // read sponsorships belonging to the same companies
        const sponsorships = (
            await Promise.all(
                companies.map((company) =>
                    ctx.db
                        .query("sponsorships")
                        .withIndex("by_company", (q) => q.eq("organisationId", company._id))
                        .collect(),
                ),
            )
        ).flat();

        return {
            isTeam: viewer.isTeam,
            organisations: companies,
            jobs: await Promise.all(
                jobs
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(async (job) => ({ ...job, expiresAt: await jobExpiry(ctx, job) })),
            ),
            sponsorships: await Promise.all(
                sponsorships
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(async (sponsor) => ({
                        ...sponsor,
                        ...(await paidTerm(ctx, sponsor._id)),
                    })),
            ),
        };
    },
});
