import { requireCheckoutClosed, purchase } from "./purchases";
import { refreshRecognition } from "../sponsorships/recognition";
import { jobExpiry, jobStatus } from "../jobs/jobs";
import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "../_generated/server";
import { requireAccount } from "../auth/access";
import { authComponent } from "../auth/component";
import { recordPayment } from "./payments";
import { paidTerm } from "./coverage";
import { requireCompany } from "../organisations/mutations";
import { personalTiers, jobPrice, jobDurationDays } from "../sponsorships/plans";

/** Reserve one purchase before creating its Stripe session. */
export const reserve = internalMutation({
    args: { purchase },
    handler: async (ctx, args) => {
        // identify the purchaser through their active account
        const viewer = await requireAccount(ctx);
        const user = await authComponent.getAuthUser(ctx);
        const now = Date.now();
        let amount = 0;
        let name = "";
        let email = user.email;
        let durationDays: number | undefined;

        let selected = args.purchase;
        if (selected.kind === "support") {
            let agreement = await ctx.db
                .query("sponsorships")
                .withIndex("by_member", (q) => q.eq("memberId", viewer.memberId))
                .unique();
            if (!agreement) {
                const id = await ctx.db.insert("sponsorships", {
                    memberId: viewer.memberId,
                    tier: selected.tier,
                    status: "requested",
                    isPublic: false,
                    createdAt: now,
                    updatedAt: now,
                });
                agreement = await ctx.db.get(id);
            }
            if (!agreement) throw new ConvexError("Sponsorship not found.");
            if (agreement.tier !== selected.tier) {
                await requireCheckoutClosed(ctx, agreement._id);
                const term = await paidTerm(ctx, agreement._id);
                if (term && term.endsAt > now)
                    throw new ConvexError("Contact us to change your active support plan.");
                await ctx.db.patch(agreement._id, { tier: selected.tier, updatedAt: now });
            }
            selected = { kind: "sponsorship", id: agreement._id };
        }

        // require ownership and derive prices entirely on the server
        if (args.purchase.kind === "job") {
            const job = await ctx.db.get(args.purchase.id);
            if (!job) throw new ConvexError("Job not found.");
            await requireCompany(ctx, job.organisationId);
            if (job.status === "draft")
                throw new ConvexError("Submit this job for review before paying.");
            amount = jobPrice;
            durationDays = jobDurationDays;
            name = `${job.title} · ${jobDurationDays} days`;
            email = job.billingEmail;
        } else if (selected.kind === "sponsorship") {
            const sponsor = await ctx.db.get(selected.id);
            if (!sponsor) throw new ConvexError("Sponsorship not found.");
            if ("memberId" in sponsor) {
                if (sponsor.memberId !== viewer.memberId)
                    throw new ConvexError("Sponsorship not found.");
            } else await requireCompany(ctx, sponsor.organisationId);
            if (sponsor.status === "declined" || sponsor.status === "ended")
                throw new ConvexError("Request a new sponsorship before paying.");

            if ("memberId" in sponsor) {
                const plan = personalTiers.find((tier) => tier.id === sponsor.tier)!;
                amount = plan.price;
                name = `${plan.name} support · one year`;
                email = user.email;
            } else {
                throw new ConvexError(
                    "Company sponsorships are settled against issued invoices in the workspace.",
                );
            }
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
                row.purchase.kind === selected.kind &&
                row.purchase.id === selected.id,
        );
        if (existing) return existing;

        // retain the purchase until its hosted session expires
        const values = {
            memberId: viewer.memberId,
            purchase: selected,
            amount,
            durationDays,
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
        const subjectId = checkout.purchase.id;

        // validate the purchased entity before recording its coverage
        if (checkout.purchase.kind === "job") {
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
                isRenewalRequested: false,
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
            durationDays: checkout.durationDays,
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
        if (!row || row.memberId !== viewer.memberId) throw new ConvexError("Payment not found.");

        const sponsorship =
            row.purchase.kind === "sponsorship" ? await ctx.db.get(row.purchase.id) : null;
        const job = row.purchase.kind === "job" ? await ctx.db.get(row.purchase.id) : null;
        const publication = job ? jobStatus(job, await jobExpiry(ctx, job)) : undefined;
        return {
            status:
                row.status === "pending" && row.expiresAt <= Date.now()
                    ? ("expired" as const)
                    : row.status,
            publication,
            purchase: row.purchase,
            isPersonal: !!sponsorship && "memberId" in sponsorship,
            invoiceUrl: row.invoiceUrl,
        };
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
        // find the recorded payment before voiding its coverage
        const payment = await ctx.db
            .query("payments")
            .withIndex("by_reference", (q) => q.eq("reference", checkout.sessionId!))
            .unique();
        if (!payment) throw new Error("Refunded payment is missing.");
        // void the payment and mark checkout refunded atomically
        await ctx.db.patch(payment._id, { refundedAt: Date.now() });
        const sponsorshipId = ctx.db.normalizeId("sponsorships", payment.subjectId);
        if (sponsorshipId) await refreshRecognition(ctx, sponsorshipId);
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
