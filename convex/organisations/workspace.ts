import { readTerms, selectTerm } from "../sponsorships/terms";
import { invoiceBalance } from "../billing/invoices";
import { presentProfiles } from "../members/links";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { requireAccount } from "../auth/access";
import { calculateJobAllowance, jobExpiry, jobStatus } from "../jobs/jobs";

/** Read the current employer's company, job and sponsorship workspace. */
export const employer = query({
    args: { directory: v.optional(v.boolean()) },
    handler: readEmployer,
});

/** Read authorised workspace records without per-company enrichment queries. */
export async function readEmployer(ctx: QueryCtx, args: { directory?: boolean }) {
    // identify the account before selecting owned records
    const viewer = await requireAccount(ctx);
    const organisations = await ctx.db.query("organisations").collect();
    const companies = organisations.filter(
        (row) =>
            viewer.isAdmin || (args.directory && viewer.isTeam) || row.ownerId === viewer.memberId,
    );

    // group editable links once, retaining position precedence and private owner links
    const companyIds = new Set(companies.map((company) => company._id));
    const links =
        viewer.isAdmin || (args.directory && viewer.isTeam)
            ? await ctx.db.query("links").collect()
            : (
                  await Promise.all(
                      companies.map((company) =>
                          ctx.db
                              .query("links")
                              .withIndex("by_owner", (q) => q.eq("ownerId", company._id))
                              .collect(),
                      ),
                  )
              ).flat();
    const linksByOwner = groupRows(links, (link) => link.ownerId);
    const profiles = new Map(
        companies.map((company) => [
            company._id,
            presentProfiles(
                (linksByOwner.get(company._id) ?? []).sort(
                    (left, right) => left.position - right.position,
                ),
            ),
        ]),
    );

    // keep financial records and account identities out of directory requests
    if (args.directory)
        return {
            owners: [],
            isAdmin: viewer.isAdmin,
            organisations: companies.map((company) => ({
                ...company,
                ...profiles.get(company._id),
            })),
            jobs: [],
            sponsorships: [],
        };

    // read jobs belonging to the visible companies
    const jobs = viewer.isAdmin
        ? (await ctx.db.query("jobs").collect()).filter((job) => companyIds.has(job.organisationId))
        : (
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
    const sponsorships = viewer.isAdmin
        ? (await ctx.db.query("sponsorships").collect()).filter(
              (sponsor) => "organisationId" in sponsor && companyIds.has(sponsor.organisationId),
          )
        : (
              await Promise.all(
                  companies.map((company) =>
                      ctx.db
                          .query("sponsorships")
                          .withIndex("by_organisation", (q) => q.eq("organisationId", company._id))
                          .collect(),
                  ),
              )
          ).flat();

    // reuse current terms and company jobs for every allowance projection
    const terms = viewer.isAdmin
        ? await ctx.db.query("sponsorshipTerms").collect()
        : (await Promise.all(sponsorships.map((sponsor) => readTerms(ctx, sponsor._id)))).flat();
    const termsBySponsor = groupRows(terms, (term) => term.sponsorshipId);
    const sponsorsByCompany = groupRows(sponsorships, (sponsor) =>
        "organisationId" in sponsor ? sponsor.organisationId : "",
    );
    const jobsByCompany = groupRows(jobs, (job) => job.organisationId);
    const now = Date.now();

    /** Project the shared allowance calculation over this company's loaded relationships. */
    function allowance(
        organisationId: Doc<"organisations">["_id"],
        excludeId?: Doc<"jobs">["_id"],
    ) {
        return calculateJobAllowance(
            sponsorsByCompany.get(organisationId) ?? [],
            termsBySponsor,
            jobsByCompany.get(organisationId) ?? [],
            now,
            excludeId,
        );
    }

    // expose assignable account identities only to administrators
    const owners = [];
    if (viewer.isAdmin) {
        const accounts = await ctx.db.query("accounts").collect();
        const members = new Map(
            (await ctx.db.query("members").collect()).map((member) => [member._id, member]),
        );
        const emails = groupRows(await ctx.db.query("emails").collect(), (email) => email.memberId);
        for (const account of accounts.filter((account) => account.status === "active")) {
            owners.push({
                memberId: account.memberId,
                name: members.get(account.memberId)?.name ?? "",
                email: emails.get(account.memberId)?.find((email) => email.verifiedAt)?.email,
            });
        }
    }

    return {
        owners,
        isAdmin: viewer.isAdmin,
        organisations: companies.map((company) => ({
            ...company,
            jobAllowance: allowance(company._id),
            ...profiles.get(company._id),
        })),
        jobs: await Promise.all(
            jobs
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map(async (job) => {
                    const expiresAt = await jobExpiry(ctx, job);
                    return {
                        ...job,
                        allowance: allowance(job.organisationId, job._id),
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
                    const terms = termsBySponsor.get(sponsor._id) ?? [];
                    const term =
                        selectTerm(terms, Date.now()) ?? selectTerm(terms, Date.now(), true);
                    const history = await Promise.all(
                        terms
                            .sort((a, b) => b.startsAt - a.startsAt || b.createdAt - a.createdAt)
                            .map(async (term) => ({
                                ...term,
                                recordedByName: (await ctx.db.get(term.recordedBy))?.name,
                                invoices: await Promise.all(
                                    (
                                        await ctx.db
                                            .query("invoices")
                                            .withIndex("by_term", (q) => q.eq("termId", term._id))
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
}

/** Group already loaded relationships in their database order. */
function groupRows<Row>(rows: Row[], key: (row: Row) => string) {
    const groups = new Map<string, Row[]>();
    for (const row of rows) {
        const id = key(row);
        const group = groups.get(id) ?? [];
        group.push(row);
        groups.set(id, group);
    }

    return groups;
}
