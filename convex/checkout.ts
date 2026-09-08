import { v } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAccount } from "./access";
import { authComponent } from "./auth/component";
import { paidTerm, recordPayment } from "./payments";
import { requireCompany } from "./organisations";
import { tiers, patron, jobPrice, principalLimit } from "../shared/plans";
import { purchase } from "./purchase";

/** Reserve one annual purchase before creating its Stripe session. */
export const reserve = internalMutation({
    args: { purchase },
    handler: async (ctx, args) => {
        // identify the purchaser through their active account
        const viewer = await requireAccount(ctx);
        const user = await authComponent.getAuthUser(ctx);
        const now = Date.now();
        let amount: number = patron.price;
        let name = "Patron · one year";
        let email = user.email;
        let sponsorship: Doc<"sponsorships"> | null = null;

        // require ownership and derive prices entirely on the server
        if (args.purchase.kind === "job") {
            const job = await ctx.db.get(args.purchase.id);
            if (!job) throw new Error("Job not found.");
            await requireCompany(ctx, job.organisationId);
            if (job.status === "draft")
                throw new Error("Submit this job for review before paying.");
            amount = jobPrice;
            name = `${job.title} · one year`;
            email = job.billingEmail;
        } else if (args.purchase.kind === "sponsorship") {
            const sponsor = await ctx.db.get(args.purchase.id);
            if (!sponsor) throw new Error("Sponsorship not found.");
            await requireCompany(ctx, sponsor.organisationId);
            if (sponsor.status === "declined" || sponsor.status === "ended")
                throw new Error("Request a new sponsorship before paying.");
            sponsorship = sponsor;
            const tier = tiers.find((tier) => tier.id === sponsor.tier)!;
            amount = tier.price;
            name = `${tier.name} sponsorship · one year`;
            email = sponsor.billingEmail;
        }

        // reuse pending sessions so retries cannot create duplicate charges
        const pending = await ctx.db
            .query("checkouts")
            .withIndex("by_status", (q) => q.eq("status", "pending"))
            .collect();
        const existing = pending.find(
            (row) =>
                row.memberId === viewer.memberId &&
                row.expiresAt > now + 60000 &&
                JSON.stringify(row.purchase) === JSON.stringify(args.purchase),
        );
        if (existing) return existing;

        // hold scarce principal places for the checkout's thirty minute lifetime
        if (sponsorship?.tier === "principal") {
            await requirePrincipalPlace(ctx, sponsorship._id);
        }

        // retain the purchase until its hosted session expires
        const values = {
            memberId: viewer.memberId,
            purchase: args.purchase,
            amount,
            name,
            email,
            status: "pending" as const,
            createdAt: now,
            expiresAt: now + 31 * 60000,
        };
        const id = await ctx.db.insert("checkouts", values);

        return { ...values, _id: id, url: undefined };
    },
});

/** Retain the hosted checkout destination for retries and payment matching. */
export const attachSession = internalMutation({
    args: { id: v.id("checkouts"), sessionId: v.string(), url: v.string() },
    handler: async (ctx, args) => {
        const { id, ...fields } = args;
        await ctx.db.patch(id, fields);
    },
});

/** Apply a verified paid session exactly once, independently of the browser redirect. */
export const complete = internalMutation({
    args: {
        id: v.id("checkouts"),
        sessionId: v.string(),
        amount: v.number(),
        currency: v.string(),
        paymentIntent: v.string(),
        invoiceUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // validate the signed payment against the reserved amount and session
        const checkout = await ctx.db.get(args.id);
        if (!checkout) throw new Error("Checkout not found.");
        if (checkout.sessionId && checkout.sessionId !== args.sessionId)
            throw new Error("Checkout session mismatch.");
        if (checkout.amount * 100 !== args.amount || args.currency !== "chf")
            throw new Error("Checkout amount or currency mismatch.");
        if (checkout.status === "paid" || checkout.status === "refunded") return;
        const now = Date.now();
        const subjectId =
            checkout.purchase.kind === "patron" ? checkout.memberId : checkout.purchase.id;

        // validate the purchased entity before recording its annual coverage
        if (checkout.purchase.kind === "patron") {
            const patron = await ctx.db
                .query("patrons")
                .withIndex("by_member", (q) => q.eq("memberId", checkout.memberId))
                .unique();
            if (!patron)
                await ctx.db.insert("patrons", { memberId: checkout.memberId, isPublic: false });
        } else if (checkout.purchase.kind === "job") {
            const job = await ctx.db.get(checkout.purchase.id);
            if (!job) throw new Error("Paid job is missing.");
            await ctx.db.patch(job._id, { sponsorshipId: undefined, updatedAt: now });
        } else {
            const sponsor = await ctx.db.get(checkout.purchase.id);
            if (!sponsor) throw new Error("Paid sponsorship is missing.");
            if (sponsor.status === "declined" || sponsor.status === "ended")
                throw new Error("Paid sponsorship was withdrawn; refund or review this payment.");
            await ctx.db.patch(sponsor._id, {
                status: "active",
                renewalRequested: false,
                updatedAt: now,
            });
        }

        // use the same payment record for hosted checkout and manual invoices
        await recordPayment(ctx, {
            reference: args.sessionId,
            subjectId,
            memberId: checkout.memberId,
            name: checkout.name,
            amount: checkout.amount,
            paidAt: now,
        });
        await ctx.db.patch(checkout._id, {
            status: "paid",
            sessionId: args.sessionId,
            paymentIntent: args.paymentIntent,
            invoiceUrl: args.invoiceUrl ?? checkout.invoiceUrl,
        });
    },
});

/** Release an expired or failed checkout reservation. */
export const expire = internalMutation({
    args: { sessionId: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query("checkouts")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .unique();
        if (row?.status === "pending") await ctx.db.patch(row._id, { status: "expired" });
    },
});

/** Read the current member's payment result without exposing another member's purchase. */
export const status = query({
    args: { sessionId: v.string() },
    handler: async (ctx, args) => {
        // identify the purchaser through their active account
        const viewer = await requireAccount(ctx);
        const row = await ctx.db
            .query("checkouts")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .unique();
        if (!row || row.memberId !== viewer.memberId) throw new Error("Payment not found.");

        return { status: row.status, purchase: row.purchase, invoiceUrl: row.invoiceUrl };
    },
});

/** Void the refunded payment; coverage is derived from the remaining payments. */
export const refund = internalMutation({
    args: { paymentIntent: v.string() },
    handler: async (ctx, args) => {
        const checkout = await ctx.db
            .query("checkouts")
            .withIndex("by_payment", (q) => q.eq("paymentIntent", args.paymentIntent))
            .unique();
        if (!checkout || checkout.status === "refunded") return;
        // find the recorded annual payment before voiding its coverage
        const payment = await ctx.db
            .query("payments")
            .withIndex("by_reference", (q) => q.eq("reference", checkout.sessionId!))
            .unique();
        if (!payment) throw new Error("Refunded payment is missing.");
        // void the payment and mark checkout refunded atomically
        await ctx.db.patch(payment._id, { refundedAt: Date.now() });
        await ctx.db.patch(checkout._id, { status: "refunded" });
    },
});

/** Retain the invoice when Stripe finishes generating it after checkout. */
export const recordInvoice = internalMutation({
    args: { id: v.id("checkouts"), url: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { invoiceUrl: args.url });
    },
});

/** Require any hosted payment for a sponsorship to finish or expire before manual changes. */
export async function requireCheckoutClosed(ctx: MutationCtx, id: Id<"sponsorships">) {
    // find unexpired hosted sessions for this sponsorship
    const pending = await ctx.db
        .query("checkouts")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();
    if (
        pending.some(
            (row) =>
                row.expiresAt > Date.now() &&
                row.purchase.kind === "sponsorship" &&
                row.purchase.id === id,
        )
    )
        throw new Error(
            "A payment is open for this sponsorship. Complete it or wait for the checkout to expire before changing it.",
        );
}

/** Count active Principal sponsors and open checkouts before allocating a place. */
export async function requirePrincipalPlace(ctx: MutationCtx, id: Id<"sponsorships">) {
    // count paid Principal places before including open reservations
    const now = Date.now();
    const active = await ctx.db
        .query("sponsorships")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect();
    const occupied = new Set<Id<"sponsorships">>();
    for (const sponsor of active) {
        const term = await paidTerm(ctx, sponsor._id);
        if (sponsor.tier === "principal" && term && term.endsAt > now) occupied.add(sponsor._id);
    }

    // include reservations from other payment sessions in the same transaction
    // find unexpired hosted sessions for this sponsorship
    const pending = await ctx.db
        .query("checkouts")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();
    for (const reservation of pending) {
        if (reservation.expiresAt > now && reservation.purchase.kind === "sponsorship") {
            const sponsor = await ctx.db.get(reservation.purchase.id);
            if (sponsor?.tier === "principal") occupied.add(sponsor._id);
        }
    }
    // exclude this renewal from its own capacity check
    occupied.delete(id);
    if (occupied.size >= principalLimit)
        throw new Error("All Principal places are currently taken.");
}
