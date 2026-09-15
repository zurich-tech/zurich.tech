import { readTerms, selectTerm } from "../sponsorships/terms";
import { invoiceBalance } from "../billing/invoices";
import { readProfiles } from "../members/links";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { requireAccount } from "../auth/access";
import { jobExpiry, jobStatus, jobAllowance } from "../jobs/jobs";

/** Read the current employer's company, job and sponsorship workspace. */
export const employer = query({
    args: {},
    handler: async (ctx) => {
        // identify the account before selecting owned records
        const viewer = await requireAccount(ctx);
        const organisations = await ctx.db.query("organisations").collect();
        const companies = organisations.filter(
            (row) => viewer.isAdmin || row.ownerId === viewer.memberId,
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

        // expose assignable account identities only to administrators
        const owners = viewer.isAdmin
            ? await Promise.all(
                  (await ctx.db.query("accounts").collect())
                      .filter((account) => account.status === "active")
                      .map(async (account) => {
                          const profile = await ctx.db.get(account.memberId);
                          const emails = await ctx.db
                              .query("emails")
                              .withIndex("by_member", (q) => q.eq("memberId", account.memberId))
                              .collect();
                          return {
                              memberId: account.memberId,
                              name: profile?.name ?? "",
                              email: emails.find((email) => email.verifiedAt)?.email,
                          };
                      }),
              )
            : [];
        return {
            owners,
            isAdmin: viewer.isAdmin,
            organisations: await Promise.all(
                companies.map(async (company) => ({
                    ...company,
                    jobAllowance: await jobAllowance(ctx, company._id),
                    ...(await readProfiles(ctx, company._id, "all")),
                })),
            ),
            jobs: await Promise.all(
                jobs
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(async (job) => {
                        const expiresAt = await jobExpiry(ctx, job);
                        return {
                            ...job,
                            allowance: await jobAllowance(ctx, job.organisationId, job._id),
                            expiresAt,
                            displayStatus: jobStatus(job, expiresAt),
                        };
                    }),
            ),
            sponsorships: await Promise.all(
                sponsorships
                    .filter(
                        (row): row is Extract<Doc<"sponsorships">, { organisationId: unknown }> =>
                            "organisationId" in row,
                    )
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map(async (sponsor) => {
                        const terms = await readTerms(ctx, sponsor._id);
                        const term =
                            selectTerm(terms, Date.now()) ?? selectTerm(terms, Date.now(), true);
                        const history = await Promise.all(
                            terms
                                .sort(
                                    (a, b) => b.startsAt - a.startsAt || b.createdAt - a.createdAt,
                                )
                                .map(async (term) => ({
                                    ...term,
                                    recordedByName: (await ctx.db.get(term.recordedBy))?.name,
                                    invoices: await Promise.all(
                                        (
                                            await ctx.db
                                                .query("invoices")
                                                .withIndex("by_term", (q) =>
                                                    q.eq("termId", term._id),
                                                )
                                                .collect()
                                        ).map(async (invoice) => ({
                                            ...invoice,
                                            ...(await invoiceBalance(ctx, invoice._id)),
                                        })),
                                    ),
                                })),
                        );
                        return { ...sponsor, tier: term?.tier ?? sponsor.tier, term, history };
                    }),
            ),
        };
    },
});
