import type { Id } from "../convex/_generated/dataModel";
import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api, internal } from "../convex/_generated/api";
import { jobExpiry, jobStatus } from "../convex/jobs/jobs";
import { paidTerm } from "../convex/billing/coverage";
import type { Job } from "../convex/jobs/fields";
import { normalizeJob } from "../convex/jobs/validation";
import { applicationHref, rangeLabel, salaryLabel } from "../convex/jobs/format";
import { newsletterEdition } from "../convex/mail/templates";

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
    const publicJobs = await backend.query(api.jobs.jobs.list, {});
    const previous = process.env.SITE_URL;
    process.env.SITE_URL = "https://example.com";
    let email;
    try {
        email = newsletterEdition([], [], publicJobs);
    } finally {
        if (previous === undefined) delete process.env.SITE_URL;
        else process.env.SITE_URL = previous;
    }
    expect(email.text).toContain("New summary");
    expect(email.html).toContain("/jobs/engineer");
    expect(email.text).not.toContain("billing@example.com");
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

test("allow admin publication during recognition without changing sponsorship dates", async () => {
    const { backend, admin, job } = await setup();
    const startsAt = Date.now() + 14 * 86400000;
    await backend.run(async (ctx) => {
        const term = (await ctx.db.query("sponsorshipTerms").collect())[0]!;
        await ctx.db.patch(term._id, { startsAt });
    });
    const id = await admin.mutation(api.jobs.jobs.save, {
        ...job,
        billingEmail: "billing@example.com",
        submit: false,
    });
    await expect(admin.mutation(api.jobs.jobs.publish, { id, funding: "sponsor" })).rejects.toThrow(
        "This company has no active sponsorship.",
    );
    await backend.run(async (ctx) => {
        const term = (await ctx.db.query("sponsorshipTerms").collect())[0]!;
        await ctx.db.patch(term._id, { publishedAt: Date.now() - 1 });
    });
    await admin.mutation(api.jobs.jobs.publish, { id, funding: "sponsor" });
    expect((await backend.query(api.jobs.jobs.list, {})).length).toBe(1);
    expect(
        await backend.run(
            async (ctx) => (await ctx.db.query("sponsorshipTerms").collect())[0]!.startsAt,
        ),
    ).toBe(startsAt);
});

test("test_charge_CHF_50_for_90_days_and_expire_at_the_boundary", async () => {
    const { backend, admin, job } = await setup();
    const id = await admin.mutation(api.jobs.jobs.save, {
        ...job,
        billingEmail: "billing@example.com",
        submit: true,
    });
    await admin.mutation(api.jobs.jobs.publish, {
        id,
        funding: "invoice",
        invoiceReference: "job-invoice",
    });
    await backend.run(async (ctx) => {
        const payment = (await ctx.db.query("payments").collect())[0]!;
        expect([payment.amount, payment.durationDays, payment.name]).toEqual([
            50,
            90,
            "Engineer · 90 days",
        ]);
        const row = (await ctx.db.get(id))!;
        const expiresAt = await jobExpiry(ctx, row);
        expect(expiresAt).toBe(payment.paidAt! + 90 * 86400000);
        expect(jobStatus(row, expiresAt, expiresAt! - 1)).toBe("published");
        expect(jobStatus(row, expiresAt, expiresAt!)).toBe("expired");
    });
});

test("test_preserve_legacy_checkouts_and_apply_90_day_renewals_and_refunds", async () => {
    const { backend, owner, admin, ids, job } = await setup();
    const id = await admin.mutation(api.jobs.jobs.save, {
        ...job,
        billingEmail: "billing@example.com",
        submit: true,
    });
    const oldCheckout = await backend.run((ctx) =>
        ctx.db.insert("checkouts", {
            memberId: ids.owner,
            purchase: { kind: "job", id },
            name: "Engineer · 6 months",
            email: "billing@example.com",
            amount: 100,
            status: "pending",
            createdAt: Date.now(),
            expiresAt: Date.now() + 1800000,
        }),
    );
    const reused = await owner.mutation(internal.billing.checkouts.reserve, {
        purchase: { kind: "job", id },
    });
    expect([reused._id, reused.amount, reused.durationDays]).toEqual([oldCheckout, 100, undefined]);
    await backend.mutation(internal.billing.checkouts.complete, {
        id: oldCheckout,
        sessionId: "old-session",
        amount: 10000,
        currency: "chf",
        paymentIntent: "old-payment",
    });

    // anchor the legacy purchase at a month end to exercise calendar-month clamping
    const paidAt = Date.UTC(2026, 7, 31);
    const legacyEnd = Date.UTC(2027, 1, 28);
    await backend.run(async (ctx) => {
        const payment = (await ctx.db.query("payments").collect())[0]!;
        await ctx.db.patch(payment._id, { paidAt });
        expect(await jobExpiry(ctx, (await ctx.db.get(id))!)).toBe(legacyEnd);
    });

    const checkout = await owner.mutation(internal.billing.checkouts.reserve, {
        purchase: { kind: "job", id },
    });
    expect([checkout.amount, checkout.durationDays, checkout.name]).toEqual([
        50,
        90,
        "Engineer · 90 days",
    ]);
    const completion = {
        id: checkout._id,
        sessionId: "new-session",
        amount: 5000,
        currency: "chf",
        paymentIntent: "new-payment",
    };
    await backend.mutation(internal.billing.checkouts.complete, completion);
    await backend.mutation(internal.billing.checkouts.complete, completion);
    await backend.run(async (ctx) => {
        const payments = await ctx.db.query("payments").collect();
        expect(payments.length).toBe(2);
        const renewal = payments.find((payment) => payment.reference === "new-session")!;
        expect(renewal.durationDays).toBe(90);
        await ctx.db.patch(renewal._id, { paidAt: paidAt + 86400000 });
        expect(await paidTerm(ctx, id, 6)).toEqual({
            startsAt: paidAt,
            endsAt: legacyEnd + 90 * 86400000,
        });
    });
    await backend.mutation(internal.billing.checkouts.refund, { paymentIntent: "new-payment" });
    expect(await backend.run((ctx) => paidTerm(ctx, id, 6))).toEqual({
        startsAt: paidAt,
        endsAt: legacyEnd,
    });
});
