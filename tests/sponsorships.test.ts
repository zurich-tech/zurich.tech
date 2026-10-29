import { convexTest, schema, modules, member } from "./backend";
import { expect, test, setSystemTime } from "bun:test";
import { api, internal } from "../convex/_generated/api";

/** Create a company request and an authenticated administrator. */
async function setup() {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Admin",
            searchText: "admin",
            visibility: "private",
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

test("confirm invoice payment without fabricating a receipt date", async () => {
    const { backend, admin, terms, now, ids } = await setup();
    const termId = await admin.mutation(api.sponsorships.terms.agree, terms);
    const invoiceId = await admin.mutation(api.billing.invoices.issue, {
        termId,
        number: "TEST-CONFIRMED",
        reference: "TEST-CONFIRMED",
        amount: 500,
        issuedAt: now - 86400000,
        dueAt: now,
        document: "invoice.pdf",
    });
    const id = await admin.mutation(api.billing.invoices.confirmPayment, {
        invoiceId,
        note: "Confirmed by the organiser; exact receipt date unavailable.",
    });
    const payment = await backend.run((ctx) => ctx.db.get(id));
    expect(
        payment && {
            invoiceId: payment.invoiceId,
            subjectId: payment.subjectId,
            amount: payment.amount,
            name: payment.name,
            reference: payment.reference,
            paidAt: payment.paidAt,
            confirmation: payment.confirmation,
            recordedBy: payment.recordedBy,
        },
    ).toEqual({
        invoiceId,
        subjectId: ids.sponsorshipId,
        amount: 500,
        name: "TEST-CONFIRMED",
        reference: `confirmation:${invoiceId}`,
        paidAt: undefined,
        confirmation: "Confirmed by the organiser; exact receipt date unavailable.",
        recordedBy: ids.memberId,
    });
    await expect(
        admin.mutation(api.billing.invoices.confirmPayment, { invoiceId, note: "Again" }),
    ).rejects.toThrow("this invoice is already paid");
    await expect(
        backend.mutation(api.billing.invoices.confirmPayment, { invoiceId, note: "Again" }),
    ).rejects.toThrow();
});

test("test_distinguish_active_sponsors_from_hosts_on_the_map", async () => {
    const { backend, admin, ids, terms } = await setup();
    await backend.run(async (ctx) => {
        await ctx.db.patch(ids.organisationId, { isHost: true });
        const addressId = await ctx.db.insert("addresses", {
            line1: "Teststrasse 1",
            locality: "Zurich",
            countryCode: "CH",
            latitude: 47.38,
            longitude: 8.5,
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("locations", {
            ownerId: ids.organisationId,
            addressId,
            name: "Office",
            visibility: "public",
        });
    });
    const markers = async () =>
        (await backend.query(api.places.map.map, {})).map(({ isSponsor, recognition }) => ({
            isSponsor,
            recognition,
        }));

    expect(await markers()).toEqual([{ isSponsor: false, recognition: "Host" }]);
    await admin.mutation(api.sponsorships.terms.agree, terms);
    expect(await markers()).toEqual([{ isSponsor: true, recognition: "Bronze sponsor" }]);
    await backend.run((ctx) => ctx.db.patch(ids.sponsorshipId, { isPublic: false }));
    expect(await markers()).toEqual([{ isSponsor: false, recognition: "Host" }]);
});

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

/** Date transitions follow current terms, including replacements made before a queued task. */
test("recognition activates and expires through scheduled agreement transitions", async () => {
    const now = Date.UTC(2026, 8, 15);
    setSystemTime(now);
    try {
        const { backend, admin, terms } = await setup();
        const id = await admin.mutation(api.sponsorships.terms.agree, {
            ...terms,
            startsAt: now + 2000,
            publishedAt: now + 1000,
            endsAt: now + 3000,
        });
        const read = () => backend.query(api.sponsorships.organisations.list, {});
        expect(await read()).toEqual([]);
        const tasks = await backend.run((ctx) =>
            ctx.db.system.query("_scheduled_functions").collect(),
        );
        expect(tasks.map((task) => task.scheduledTime)).toEqual([now + 1000]);
        setSystemTime(now + 1000);
        await backend.mutation(internal.sponsorships.recognition.advance, {
            id: terms.sponsorshipId,
            at: now + 1000,
        });
        expect((await read()).map((sponsor) => sponsor.tier)).toEqual(["bronze"]);
        await admin.mutation(api.sponsorships.terms.agree, {
            ...terms,
            replacesId: id,
            tier: "silver",
            startsAt: now + 2000,
            publishedAt: now + 1000,
            endsAt: now + 5000,
        });
        setSystemTime(now + 3000);
        await backend.mutation(internal.sponsorships.recognition.advance, {
            id: terms.sponsorshipId,
            at: now + 2000,
        });
        await backend.mutation(internal.sponsorships.recognition.advance, {
            id: terms.sponsorshipId,
            at: now + 3000,
        });
        expect((await read()).map((sponsor) => sponsor.tier)).toEqual(["silver"]);
        setSystemTime(now + 5000);
        await backend.mutation(internal.sponsorships.recognition.advance, {
            id: terms.sponsorshipId,
            at: now + 5000,
        });
        expect(await read()).toEqual([]);
        expect(
            (await backend.run((ctx) => ctx.db.get(terms.sponsorshipId)))?.recognitionAt,
        ).toBeUndefined();
    } finally {
        setSystemTime();
    }
});

/** Paid personal support expires without an unrelated database write. */
test("personal recognition schedules the end of paid coverage", async () => {
    const now = Date.UTC(2026, 8, 15);
    setSystemTime(now);
    try {
        const { backend, ids } = await setup();
        const { recordPayment } = await import("../convex/billing/payments");
        const id = await backend.run(async (ctx) => {
            const id = await ctx.db.insert("sponsorships", {
                memberId: ids.memberId,
                tier: "friend",
                status: "active",
                isPublic: true,
                createdAt: now,
                updatedAt: now,
            });
            await recordPayment(ctx, {
                subjectId: id,
                name: "Support",
                amount: 100,
                paidAt: now,
                reference: "personal",
            });
            return id;
        });
        expect(
            (await backend.query(api.sponsorships.members.list, {})).map((member) => member.tier),
        ).toEqual(["friend"]);
        const endsAt = (await backend.run((ctx) => ctx.db.get(id)))!.recognitionAt!;
        expect(endsAt).toBe(Date.UTC(2027, 8, 15));
        setSystemTime(endsAt);
        await backend.mutation(internal.sponsorships.recognition.advance, { id, at: endsAt });
        expect(await backend.query(api.sponsorships.members.list, {})).toEqual([]);
    } finally {
        setSystemTime();
    }
});
