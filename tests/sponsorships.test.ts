import { expect, test, mock } from "bun:test";
import { convexTest } from "convex-test";
import type { GenericQueryCtx, GenericDataModel } from "convex/server";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";

mock.module("../convex/auth/component", () => ({
    authComponent: {
        getAuthUser: async (ctx: GenericQueryCtx<GenericDataModel>) => {
            const identity = await ctx.auth.getUserIdentity();
            if (!identity) throw new Error("Sign in required.");
            return { _id: identity.subject, email: "test@example.invalid", emailVerified: true };
        },
    },
}));
const modules = Object.fromEntries(
    [...new Bun.Glob("**/*.ts").scanSync({ cwd: "convex" })].map((path) => [
        `../convex/${path}`,
        () => import(`../convex/${path}`),
    ]),
);

/** Create a company request and an authenticated administrator. */
async function setup() {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const memberId = await ctx.db.insert("members", {
            name: "Admin",
            status: "active",
            searchText: "admin",
            visibility: "private",
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("accounts", {
            authId: "admin",
            memberId,
            status: "active",
            isAdmin: true,
            isTeam: true,
            createdAt: 1,
            updatedAt: 1,
        });
        const organisationId = await ctx.db.insert("organisations", {
            name: "Sponsor",
            slug: "sponsor",
            description: "",
            kind: "company",
            website: "https://example.org",
            location: "Zurich",
            updatedAt: 1,
            ownerId: memberId,
        });
        const sponsorshipId = await ctx.db.insert("sponsorships", {
            organisationId,
            tier: "bronze",
            status: "requested",
            isPublic: true,
            createdAt: 1,
            updatedAt: 1,
        });
        return { memberId, organisationId, sponsorshipId };
    });
    const admin = backend.withIdentity({ subject: "admin" });
    const now = Date.now();
    const terms = {
        sponsorshipId: ids.sponsorshipId,
        tier: "bronze" as const,
        contribution: { kind: "money" as const, amount: 500 },
        startsAt: now + 86400000,
        endsAt: now + 366 * 86400000,
        publishedAt: now - 1000,
        reason: "Agreed sponsorship",
    };
    return { backend, admin, ids, terms, now };
}

test("test_publish_before_payment_and_preserve_dates_through_partial_receipts_and_refunds", async () => {
    const { backend, admin, terms, now } = await setup();
    const termId = await admin.mutation(api.sponsorships.terms.agree, terms);
    expect(
        (await backend.query(api.sponsorships.organisations.list, {})).map((s) => s.tier),
    ).toEqual(["bronze"]);
    expect(await backend.run((ctx) => ctx.db.query("payments").collect())).toEqual([]);
    const invoiceId = await admin.mutation(api.billing.invoices.issue, {
        termId,
        number: "ZT-2026-001",
        reference: "RF87ZT2026001",
        amount: 500,
        issuedAt: now - 86400000,
        dueAt: now + 30 * 86400000,
        document: "invoice.pdf",
    });
    const paymentId = await admin.mutation(api.billing.invoices.receive, {
        invoiceId,
        amount: 200,
        paidAt: now - 500,
        reference: "BANK-1",
    });
    await expect(
        admin.mutation(api.billing.invoices.receive, {
            invoiceId,
            amount: 200,
            paidAt: now - 500,
            reference: "BANK-1",
        }),
    ).rejects.toThrow("This payment has already been recorded.");
    let workspace = await admin.query(api.organisations.workspace.employer, {});
    expect(workspace.sponsorships[0].history[0].invoices[0].balance).toBe(300);
    await admin.mutation(api.billing.invoices.refund, {
        paymentId,
        amount: 50,
        paidAt: now,
        reference: "REFUND-1",
        reason: "Adjustment",
    });
    workspace = await admin.query(api.organisations.workspace.employer, {});
    expect(workspace.sponsorships[0].history[0].invoices[0].balance).toBe(350);
    const term = await backend.run((ctx) => ctx.db.get(termId));
    expect([term!.startsAt, term!.endsAt]).toEqual([terms.startsAt, terms.endsAt]);
    await expect(
        admin.mutation(api.billing.invoices.refund, {
            paymentId,
            amount: 151,
            paidAt: now,
            reference: "REFUND-2",
            reason: "Too much",
        }),
    ).rejects.toThrow("Refunds cannot exceed the payment received.");
});

test("test_retain_amendments_invoices_and_renewals_without_overlapping_terms", async () => {
    const { backend, admin, terms, now } = await setup();
    const original = await admin.mutation(api.sponsorships.terms.agree, terms);
    await expect(admin.mutation(api.sponsorships.terms.agree, terms)).rejects.toThrow(
        "Agreement dates overlap an existing term. Amend that term or choose a later start.",
    );
    const replacement = await admin.mutation(api.sponsorships.terms.agree, {
        ...terms,
        tier: "silver",
        replacesId: original,
        reason: "Upgraded agreement",
    });
    expect((await backend.run((ctx) => ctx.db.get(original)))!.supersededAt).toBeDefined();
    expect((await backend.query(api.sponsorships.organisations.list, {}))[0].tier).toBe("silver");
    await admin.mutation(api.sponsorships.terms.agree, {
        ...terms,
        startsAt: terms.endsAt,
        endsAt: terms.endsAt + 365 * 86400000,
        publishedAt: terms.endsAt,
        reason: "Renewed",
    });
    await admin.mutation(api.sponsorships.terms.end, {
        id: replacement,
        endedAt: now - 1,
        reason: "Agreement cancelled",
    });
    expect(await backend.query(api.sponsorships.organisations.list, {})).toEqual([]);
    expect((await backend.run((ctx) => ctx.db.query("sponsorshipTerms").collect())).length).toBe(3);
});

test("test_require_admin_and_validate_money_dates_and_invoice_identity", async () => {
    const { backend, admin, terms, now } = await setup();
    await expect(backend.mutation(api.sponsorships.terms.agree, terms)).rejects.toThrow(
        "Sign in required.",
    );
    const termId = await admin.mutation(api.sponsorships.terms.agree, terms);
    const invoice = {
        termId,
        number: "ZT-1",
        reference: "RF1",
        amount: 500,
        issuedAt: now,
        dueAt: now + 1000,
        document: "invoice.pdf",
    };
    await admin.mutation(api.billing.invoices.issue, invoice);
    await expect(admin.mutation(api.billing.invoices.issue, invoice)).rejects.toThrow(
        "This invoice number or payment reference is already registered.",
    );
    await expect(
        admin.mutation(api.billing.invoices.issue, {
            ...invoice,
            number: "ZT-2",
            reference: "RF2",
            amount: -1,
        }),
    ).rejects.toThrow("Enter a positive CHF amount with at most two decimals.");
});
