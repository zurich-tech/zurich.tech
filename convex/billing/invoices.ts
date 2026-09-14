import { v } from "convex/values";
import { mutation, internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireAdmin } from "../auth/access";
import { recordPayment } from "./payments";

/** Issued invoice identity and agreed charges, never a payment assertion. */
export const invoiceFields = {
    termId: v.id("sponsorshipTerms"),
    number: v.string(),
    reference: v.string(),
    amount: v.number(),
    issuedAt: v.number(),
    dueAt: v.number(),
    document: v.string(),
};

/** Validate a positive amount expressed in CHF. */
export function requireAmount(amount: number) {
    if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isSafeInteger(Math.round(amount * 100)) ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
    )
        throw new Error("Enter a positive CHF amount with at most two decimals.");
}

/** Register an issued invoice without sending mail or recording payment. */
export const issue = mutation({
    args: invoiceFields,
    handler: async (ctx, args) => {
        const reviewer = await requireAdmin(ctx);
        return await issueInvoice(ctx, args, reviewer.memberId);
    },
});

/** Register a reviewed invoice through the administrative CLI. */
export const record = internalMutation({
    args: { ...invoiceFields, recordedBy: v.id("members") },
    handler: async (ctx, { recordedBy, ...args }) => issueInvoice(ctx, args, recordedBy),
});

/** Retain the issued document and reject duplicate invoice identities. */
export async function issueInvoice(
    ctx: MutationCtx,
    args: {
        termId: Id<"sponsorshipTerms">;
        number: string;
        reference: string;
        amount: number;
        issuedAt: number;
        dueAt: number;
        document: string;
    },
    recordedBy: Id<"members">,
) {
    const term = await ctx.db.get(args.termId);
    if (!term || term.contribution.kind !== "money")
        throw new Error("Select a monetary agreement.");
    requireAmount(args.amount);
    if (![args.issuedAt, args.dueAt].every(Number.isFinite) || args.dueAt < args.issuedAt)
        throw new Error("Enter valid invoice and due dates.");
    const number = args.number.trim(),
        reference = args.reference.replace(/\s/g, "").toUpperCase(),
        document = args.document.trim();
    if (!number || !reference || !document)
        throw new Error(
            "Enter the invoice number, payment reference and document filename or HTTPS URL.",
        );
    if (document.includes(":") && !document.startsWith("https://"))
        throw new Error("Use an HTTPS document URL or a filename.");
    for (const [index, field, value] of [
        ["by_number", "number", number],
        ["by_reference", "reference", reference],
    ] as const) {
        if (
            await ctx.db
                .query("invoices")
                .withIndex(index, (q) => q.eq(field, value))
                .unique()
        )
            throw new Error("This invoice number or payment reference is already registered.");
    }
    return await ctx.db.insert("invoices", {
        ...args,
        number,
        reference,
        document,
        recordedBy,
        createdAt: Date.now(),
    });
}

/** Record a bank receipt against an invoice using its actual amount and value date. */
export const receive = mutation({
    args: {
        invoiceId: v.id("invoices"),
        amount: v.number(),
        paidAt: v.number(),
        reference: v.string(),
    },
    handler: async (ctx, args) => {
        const reviewer = await requireAdmin(ctx);
        const invoice = await ctx.db.get(args.invoiceId);
        if (!invoice || invoice.voidedAt) throw new Error("Select an open invoice.");
        requireAmount(args.amount);
        if (!Number.isFinite(args.paidAt) || args.paidAt > Date.now())
            throw new Error("Enter the actual receipt date, no later than today.");
        const term = await ctx.db.get(invoice.termId);
        if (!term) throw new Error("Invoice agreement is missing.");
        return await recordPayment(ctx, {
            ...args,
            subjectId: term.sponsorshipId,
            name: invoice.number,
            recordedBy: reviewer.memberId,
        });
    },
});

/** Retain a returned amount without moving sponsorship dates. */
export const refund = mutation({
    args: {
        paymentId: v.id("payments"),
        amount: v.number(),
        paidAt: v.number(),
        reference: v.string(),
        reason: v.string(),
    },
    handler: async (ctx, args) => {
        const reviewer = await requireAdmin(ctx);
        const payment = await ctx.db.get(args.paymentId);
        if (!payment?.invoiceId) throw new Error("Select an invoice payment.");
        requireAmount(args.amount);
        if (
            !Number.isFinite(args.paidAt) ||
            args.paidAt > Date.now() ||
            args.paidAt < payment.paidAt ||
            !args.reason.trim() ||
            !args.reference.trim()
        )
            throw new Error("Enter the refund date, bank reference and reason.");
        const refunds = await ctx.db
            .query("refunds")
            .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
            .collect();
        if (
            Math.round((refunds.reduce((sum, row) => sum + row.amount, 0) + args.amount) * 100) >
            Math.round(payment.amount * 100)
        )
            throw new Error("Refunds cannot exceed the payment received.");
        if (
            await ctx.db
                .query("refunds")
                .withIndex("by_reference", (q) => q.eq("reference", args.reference.trim()))
                .unique()
        )
            throw new Error("This refund has already been recorded.");
        return await ctx.db.insert("refunds", {
            ...args,
            reference: args.reference.trim(),
            reason: args.reason.trim(),
            recordedBy: reviewer.memberId,
            createdAt: Date.now(),
        });
    },
});

/** Void an incorrect invoice while retaining its identity and explanation. */
export const voidInvoice = mutation({
    args: { id: v.id("invoices"), reason: v.string() },
    handler: async (ctx, args) => {
        const reviewer = await requireAdmin(ctx);
        const invoice = await ctx.db.get(args.id);
        if (!invoice || invoice.voidedAt || !args.reason.trim())
            throw new Error("Select an open invoice and explain why it is void.");
        const balance = await invoiceBalance(ctx, invoice._id);
        if (balance.received !== 0)
            throw new Error("Return the received funds before voiding this invoice.");
        await ctx.db.patch(invoice._id, {
            voidedAt: Date.now(),
            voidedBy: reviewer.memberId,
            voidReason: args.reason.trim(),
        });
    },
});

/** Calculate settlement from receipts and refunds rather than a mutable status flag. */
export async function invoiceBalance(ctx: Pick<QueryCtx, "db">, invoiceId: Id<"invoices">) {
    const invoice = await ctx.db.get(invoiceId);
    if (!invoice) throw new Error("Invoice not found.");
    const payments = await ctx.db
        .query("payments")
        .withIndex("by_invoice", (q) => q.eq("invoiceId", invoiceId))
        .collect();
    const receipts = await Promise.all(
        payments.map(async (payment) => ({
            ...payment,
            refunds: await ctx.db
                .query("refunds")
                .withIndex("by_payment", (q) => q.eq("paymentId", payment._id))
                .collect(),
        })),
    );
    const received =
        Math.round(
            receipts.reduce(
                (sum, payment) =>
                    sum +
                    payment.amount -
                    payment.refunds.reduce((total, refund) => total + refund.amount, 0),
                0,
            ) * 100,
        ) / 100;
    return {
        payments: receipts,
        received,
        balance: Math.round((invoice.amount - received) * 100) / 100,
    };
}
