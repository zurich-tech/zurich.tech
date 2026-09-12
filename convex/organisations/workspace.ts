import { readProfiles } from "../members/links";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireAccount } from "../auth/access";
import { sponsorshipTerm } from "../sponsorships/organisations";
import { jobExpiry, jobStatus } from "../jobs/jobs";

/** Read the current employer's company, job and sponsorship workspace. */
export const employer = query({
    args: {},
    handler: async (ctx) => {
        // identify the account before selecting owned records
        const viewer = await requireAccount(ctx);
        const organisations = await ctx.db.query("organisations").collect();
        const companies = organisations.filter(
            (row) => viewer.isTeam || row.ownerId === viewer.memberId,
        );

        // read jobs belonging to the visible companies
        const jobs = (
            await Promise.all(
                companies.map((company) =>
                    ctx.db
                        .query("jobs")
                        .withIndex("by_organisation", (q) => q.eq("organisationId", company._id))
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
                        .withIndex("by_organisation", (q) => q.eq("organisationId", company._id))
                        .collect(),
                ),
            )
        ).flat();

        return {
            isTeam: viewer.isTeam,
            organisations: await Promise.all(
                companies.map(async (company) => ({
                    ...company,
                    ...(await readProfiles(ctx, company._id, "all")),
                })),
            ),
            jobs: await Promise.all(
                jobs
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(async (job) => {
                        const expiresAt = await jobExpiry(ctx, job);
                        return { ...job, expiresAt, displayStatus: jobStatus(job, expiresAt) };
                    }),
            ),
            sponsorships: await Promise.all(
                sponsorships
                    .filter(
                        (row): row is Extract<Doc<"sponsorships">, { organisationId: unknown }> =>
                            "organisationId" in row,
                    )
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(async (sponsor) => ({
                        ...sponsor,
                        ...(await sponsorshipTerm(ctx, sponsor)),
                    })),
            ),
        };
    },
});
