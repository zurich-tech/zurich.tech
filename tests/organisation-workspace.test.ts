import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";
import { readEmployer } from "../convex/organisations/workspace";
import { calculateJobAllowance, jobAllowance, jobExpiry } from "../convex/jobs/jobs";

/** Seed editable organisations and distinct account privileges. */
async function setup(count = 2) {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const members = [];
        for (const authId of ["admin", "owner", "team", "disabled"]) {
            const memberId = await member(ctx, {
                name: authId,
                searchText: authId,
                visibility: "private",
            });
            members.push(memberId);
            await ctx.db.insert("accounts", {
                authId,
                memberId,
                isAdmin: authId === "admin",
                isTeam: authId === "team",
                status: authId === "disabled" ? "disabled" : "active",
                createdAt: 1,
                updatedAt: 1,
            });
        }
        const organisations = [];
        for (let index = 0; index < count; index++) {
            const organisationId = await ctx.db.insert("organisations", {
                name: `Company ${index}`,
                slug: `company-${index}`,
                kind: "company",
                description: "Develops instruments",
                location: "Zurich",
                website: "https://example.org",
                ownerId: index === 0 ? members[1] : members[0],
                updatedAt: index,
            });
            organisations.push(organisationId);
            // insert out of position order and retain private editable destinations
            for (const position of [2, 0, 1]) {
                await ctx.db.insert("links", {
                    ownerId: organisationId,
                    kind: "website",
                    url: `https://example.org/${index}/${position}`,
                    position,
                    visibility: position === 2 ? "private" : "public",
                    createdAt: 1,
                    updatedAt: 1,
                });
            }
        }

        return { members, organisations };
    });

    return { backend, ...ids };
}

test("test_read_1689_organisations_with_constant_workspace_query_budget", async () => {
    const { backend } = await setup(1689);
    const admin = backend.withIdentity({ subject: "admin" });
    for (const directory of [false, true]) {
        await admin.run(async (ctx) => {
            let queries = 0;
            const db = new Proxy(ctx.db, {
                get(target, key) {
                    if (key === "get")
                        throw new Error("Empty financial history needs no per-record gets.");
                    if (key === "query")
                        return (...args: Parameters<typeof ctx.db.query>) => {
                            queries++;
                            if (queries > 9)
                                throw new Error("Workspace exceeded its table query budget.");

                            return target.query(...args);
                        };

                    return Reflect.get(target, key);
                },
            });
            const result = await readEmployer({ ...ctx, db }, { directory });
            expect(queries).toBe(directory ? 3 : 9);
            expect(result.organisations).toHaveLength(1689);
            expect(
                result.organisations.every((company) => company.socials?.website?.endsWith("/2")),
            ).toBe(true);
            expect(result.jobs).toEqual([]);
            expect(result.sponsorships).toEqual([]);
            expect(result.owners.map((owner) => owner.name)).toEqual(
                directory ? [] : ["admin", "owner", "team"],
            );
        });
    }
});

test("test_preserve_workspace_ownership_directory_privileges_and_authentication", async () => {
    const { backend, organisations, members } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.insert("sponsorships", {
            organisationId: organisations[1],
            tier: "bronze",
            status: "requested",
            isPublic: false,
            billingEmail: "private@example.org",
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("sponsorships", {
            memberId: members[0],
            tier: "friend",
            status: "active",
            isPublic: false,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    for (const subject of ["owner", "team", "admin"]) {
        for (const directory of [false, true]) {
            const result = await backend
                .withIdentity({ subject })
                .query(api.organisations.workspace.employer, { directory });
            const expectedIds =
                subject === "admin" || (subject === "team" && directory)
                    ? organisations
                    : subject === "owner"
                      ? [organisations[0]]
                      : [];
            expect(result.organisations.map((company) => company._id)).toEqual(expectedIds);
            expect(result.sponsorships).toHaveLength(subject === "admin" && !directory ? 1 : 0);
            expect(result.owners).toHaveLength(subject === "admin" && !directory ? 3 : 0);
            if (directory) {
                expect(result.jobs).toEqual([]);
                expect(result.organisations.every((company) => !("jobAllowance" in company))).toBe(
                    true,
                );
            }
        }
    }
    await expect(backend.query(api.organisations.workspace.employer, {})).rejects.toThrow(
        "Sign in required.",
    );
    await expect(
        backend
            .withIdentity({ subject: "disabled" })
            .query(api.organisations.workspace.employer, {}),
    ).rejects.toThrow("An active account is required.");
});

test("test_read_directory_without_financial_or_member_identity_queries", async () => {
    const { backend } = await setup();
    for (const subject of ["owner", "team", "admin"]) {
        await backend.withIdentity({ subject }).run(async (ctx) => {
            const tables: string[] = [];
            const db = new Proxy(ctx.db, {
                get(target, key) {
                    if (key === "get")
                        throw new Error("Directory must not read individual records.");
                    if (key === "query")
                        return (...args: Parameters<typeof ctx.db.query>) => {
                            tables.push(args[0]);

                            return target.query(...args);
                        };

                    return Reflect.get(target, key);
                },
            });
            await readEmployer({ ...ctx, db }, { directory: true });
            expect(tables).toEqual(["accounts", "organisations", "links"]);
        });
    }
});

test("test_select_first_eligible_agreement_without_mutating_loaded_terms", async () => {
    const { backend, organisations, members } = await setup();
    const now = Date.now();
    await backend.run(async (ctx) => {
        for (const tier of ["bronze", "gold"] as const) {
            const sponsorshipId = await ctx.db.insert("sponsorships", {
                organisationId: organisations[0],
                tier,
                status: "active",
                isPublic: true,
                createdAt: 1,
                updatedAt: 1,
            });
            await ctx.db.insert("sponsorshipTerms", {
                sponsorshipId,
                tier,
                contribution: { kind: "money", amount: 500 },
                startsAt: now - 1000,
                endsAt: now + 1000,
                reason: "Agreement",
                recordedBy: members[0],
                createdAt: 1,
            });
        }
        const sponsors = await ctx.db.query("sponsorships").collect();
        const terms = await ctx.db.query("sponsorshipTerms").collect();
        const grouped = new Map(terms.map((term) => [term.sponsorshipId, [term]]));
        const before = structuredClone({ sponsors, grouped });
        const expected = {
            id: sponsors[0]._id,
            tier: "bronze",
            startsAt: now - 1000,
            endsAt: now + 1000,
            limit: 2,
            available: 2,
        } as const;
        expect(calculateJobAllowance(sponsors, grouped, [], now)).toEqual(expected);
        expect({ sponsors, grouped }).toEqual(before);

        // an explicitly ended first term allows the next agreement, never a combined allowance
        grouped.get(sponsors[0]._id)![0] = { ...terms[0], endedAt: now };
        expect(calculateJobAllowance(sponsors, grouped, [], now)).toEqual({
            ...expected,
            id: sponsors[1]._id,
            tier: "gold",
            limit: null,
            available: null,
        });
        expect(calculateJobAllowance(sponsors, grouped, [], now + 1000)).toBeNull();
    });
});

test("test_match_publication_allowances_for_terms_capacity_and_job_exclusion", async () => {
    const { backend, organisations, members } = await setup(7);
    const now = Date.now();
    await backend.run(async (ctx) => {
        for (const [index, organisationId] of organisations.entries()) {
            const sponsor = await ctx.db.insert("sponsorships", {
                organisationId,
                tier: "bronze",
                status: index === 5 ? "ended" : "active",
                isPublic: true,
                createdAt: 1,
                updatedAt: index,
            });
            await ctx.db.insert("sponsorshipTerms", {
                sponsorshipId: sponsor,
                tier: index === 4 ? "gold" : "bronze",
                contribution: { kind: "money", amount: 500 },
                startsAt: index === 3 ? now + 86400000 : now - 86400000,
                endsAt: index === 2 ? now - 1 : now + 86400000 * 365,
                publishedAt: now - 1000,
                supersededAt: index === 6 ? now - 1 : undefined,
                reason: "Agreement",
                recordedBy: members[0],
                createdAt: 1,
            });
            // include oversubscribed, expired and unlimited plans as well as excluded jobs
            for (let position = 0; position < (index === 1 ? 4 : 1); position++) {
                await ctx.db.insert("jobs", {
                    organisationId,
                    sponsorshipId: sponsor,
                    title: "Engineer",
                    slug: `job-${index}-${position}`,
                    summary: "Build instruments",
                    description: "Develop instruments",
                    locations: [],
                    workplace: "onsite",
                    engagement: "employment",
                    topics: [],
                    skills: [],
                    languages: [],
                    application: { kind: "url", url: "https://example.org/jobs" },
                    billingEmail: "jobs@example.org",
                    createdBy: members[0],
                    updatedBy: members[0],
                    createdAt: 1,
                    updatedAt: index,
                    status: "published",
                    publishedAt: now,
                    confirmedAt: now,
                });
            }
        }
    });
    await backend.withIdentity({ subject: "admin" }).run(async (ctx) => {
        const result = await readEmployer(ctx, {});
        // assert concrete capacity as well as parity between the two loading paths
        expect(
            result.organisations.map((company) => {
                const allowance = "jobAllowance" in company ? company.jobAllowance : null;

                return allowance
                    ? { limit: allowance.limit, available: allowance.available }
                    : null;
            }),
        ).toEqual([
            { limit: 2, available: 1 },
            { limit: 2, available: 0 },
            null,
            { limit: 2, available: 1 },
            { limit: null, available: null },
            null,
            null,
        ]);
        for (const company of result.organisations) {
            expect("jobAllowance" in company && company.jobAllowance).toEqual(
                await jobAllowance(ctx, company._id),
            );
        }
        for (const job of result.jobs) {
            expect(job.allowance).toEqual(await jobAllowance(ctx, job.organisationId, job._id));
            expect(job.expiresAt).toBe(await jobExpiry(ctx, job));
        }
        expect(
            result.jobs.find((job) => job.organisationId === organisations[0])?.allowance
                ?.available,
        ).toBe(2);
        expect(
            result.jobs
                .filter((job) => job.organisationId === organisations[1])
                .map((job) => job.allowance?.available),
        ).toEqual([0, 0, 0, 0]);
        expect(result.sponsorships).toHaveLength(7);
        expect(
            result.sponsorships.every((sponsor) => sponsor.history[0].recordedByName === "admin"),
        ).toBe(true);
    });
});
