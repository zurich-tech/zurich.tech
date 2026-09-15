import type { Id } from "../convex/_generated/dataModel";
import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";
import type { Job } from "../convex/jobs/fields";
import { normalizeJob } from "../convex/jobs/validation";
import { applicationHref, rangeLabel, salaryLabel } from "../src/jobs/format";

/** Exercise employer editing, admin publication and shared public eligibility. */
async function setup() {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const owner = await member(ctx, {
            name: "Employer",
            searchText: "employer",
            visibility: "public",
        });
        const admin = await member(ctx, {
            name: "Admin",
            searchText: "admin",
            visibility: "private",
        });
        for (const [authId, memberId, isAdmin] of [
            ["owner", owner, false],
            ["admin", admin, true],
        ] as const) {
            await ctx.db.insert("accounts", {
                authId,
                memberId,
                isAdmin,
                isTeam: isAdmin,
                status: "active",
                createdAt: 1,
                updatedAt: 1,
            });
        }
        const organisationId = await ctx.db.insert("organisations", {
            ownerId: owner,
            name: "Example",
            slug: "example",
            kind: "startup",
            website: "https://example.com",
            location: "Zurich",
            description: "Robotics",
            updatedAt: 1,
        });
        const sponsor = await ctx.db.insert("sponsorships", {
            organisationId,
            tier: "bronze",
            status: "active",
            isPublic: true,
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("sponsorshipTerms", {
            sponsorshipId: sponsor,
            tier: "bronze",
            contribution: { kind: "money", amount: 500 },
            startsAt: Date.now() - 1000,
            endsAt: Date.now() + 86400000 * 365,
            reason: "Test",
            recordedBy: admin,
            createdAt: 1,
        });
        return { organisationId, owner, admin };
    });
    const job: Job = {
        organisationId: ids.organisationId,
        title: "Engineer",
        slug: "engineer",
        summary: "Build robot controls.",
        description: "## Role\nBuild robots.",
        locations: [{ locality: "Zurich", countryCode: "CH" }],
        workplace: "onsite",
        engagement: "employment",
        topics: [],
        skills: ["Python"],
        languages: [],
        application: { kind: "email", email: "jobs@example.com", subject: "Engineer & robotics" },
    };
    return {
        backend,
        owner: backend.withIdentity({ subject: "owner" }),
        admin: backend.withIdentity({ subject: "admin" }),
        ids,
        job,
    };
}

test("validate disclosed compensation and preserve unknown quantities", async () => {
    const { job } = await setup();
    expect(normalizeJob(job)).toEqual({ ...job, remoteEligibility: undefined });
    for (const amount of [{}, { min: -1 }, { min: 2, max: 1 }, { max: Infinity }]) {
        expect(() =>
            normalizeJob({
                ...job,
                compensation: {
                    salary: { currency: "CHF", period: "year", basis: "full-time", amount },
                },
            }),
        ).toThrow("Enter a valid salary range.");
    }
    expect(() => normalizeJob({ ...job, workload: { min: 101 } })).toThrow(
        "Enter a valid workload range.",
    );
    expect(() =>
        normalizeJob({ ...job, application: { kind: "url", url: "javascript:alert(1)" } }),
    ).toThrow("Use an HTTP or HTTPS URL.");
    expect(rangeLabel({ min: 100000 })).toBe("From 100’000");
    expect(
        salaryLabel({
            currency: "EUR",
            period: "month",
            basis: "workload",
            amount: { min: 5000, max: 6000 },
        }),
    ).toBe("EUR 5’000–6’000 / month");
    expect(applicationHref(job.application)).toBe(
        "mailto:jobs@example.com?subject=Engineer%20%26%20robotics",
    );
});

test("keep employer revisions private until admin approval and omit billing from public jobs", async () => {
    const { backend, owner, admin, ids, job } = await setup();
    const id = await admin.mutation(api.jobs.jobs.save, {
        ...job,
        billingEmail: "billing@example.com",
        submit: false,
    });
    expect(await backend.query(api.jobs.jobs.list, {})).toEqual([]);
    await expect(owner.mutation(api.jobs.jobs.publish, { id, funding: "sponsor" })).rejects.toThrow(
        "Admin access is required.",
    );
    await admin.mutation(api.jobs.jobs.publish, { id, funding: "sponsor" });
    await owner.mutation(api.jobs.jobs.save, {
        ...job,
        id,
        summary: "New summary",
        billingEmail: "billing@example.com",
        submit: true,
    });
    const published = await backend.query(api.jobs.jobs.detail, { slug: job.slug });
    expect(published?.summary).toBe(job.summary);
    expect(published).not.toHaveProperty("billingEmail");
    expect(published).not.toHaveProperty("draft");
    const stored = await backend.run((ctx) => ctx.db.get(id));
    expect([stored?.createdBy, stored?.updatedBy]).toEqual([ids.admin, ids.owner]);
    await admin.mutation(api.jobs.jobs.publish, { id, funding: "existing" });
    expect((await backend.query(api.jobs.jobs.detail, { slug: job.slug }))?.summary).toBe(
        "New summary",
    );
});

test("reuse closed and stale sponsor slots without overbooking on reconfirmation", async () => {
    const { backend, owner, admin, job } = await setup();
    const ids: Id<"jobs">[] = [];
    for (let index = 0; index < 3; index++)
        ids.push(
            await owner.mutation(api.jobs.jobs.save, {
                ...job,
                slug: `role-${index}`,
                billingEmail: "billing@example.com",
                submit: true,
            }),
        );
    await admin.mutation(api.jobs.jobs.publish, { id: ids[0]!, funding: "sponsor" });
    await admin.mutation(api.jobs.jobs.publish, { id: ids[1]!, funding: "sponsor" });
    await expect(
        admin.mutation(api.jobs.jobs.publish, { id: ids[2]!, funding: "sponsor" }),
    ).rejects.toThrow("All included job slots are in use.");
    await backend.run((ctx) => ctx.db.patch(ids[0]!, { confirmedAt: Date.now() - 91 * 86400000 }));
    await admin.mutation(api.jobs.jobs.publish, { id: ids[2]!, funding: "sponsor" });
    await expect(
        owner.mutation(api.jobs.jobs.updateStatus, { id: ids[0]!, action: "confirm" }),
    ).rejects.toThrow("No sponsorship slot is available to reconfirm this job.");
    await owner.mutation(api.jobs.jobs.updateStatus, { id: ids[1]!, action: "close" });
    await owner.mutation(api.jobs.jobs.updateStatus, { id: ids[0]!, action: "confirm" });
    expect((await backend.query(api.jobs.jobs.list, {})).length).toBe(2);
    await backend.run((ctx) => ctx.db.patch(ids[0]!, { applicationDeadline: Date.now() - 1 }));
    expect((await backend.query(api.jobs.jobs.list, {})).map((job) => job.slug)).toEqual([
        "role-2",
    ]);
});
