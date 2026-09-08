import { query } from "./_generated/server";
import { requireAccount } from "./access";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/** List the current member's completed payments and invoices. */
export const history = query({
    args: {},
    handler: async (ctx) => {
        // identify the purchaser through their active account
        const viewer = await requireAccount(ctx);
        const rows = await ctx.db
            .query("payments")
            .withIndex("by_member", (q) => q.eq("memberId", viewer.memberId))
            .order("desc")
            .collect();

        return await Promise.all(
            rows.map(async (payment) => {
                const checkout = await ctx.db
                    .query("checkouts")
                    .withIndex("by_session", (q) => q.eq("sessionId", payment.reference))
                    .unique();

                return {
                    id: payment._id,
                    name: payment.name,
                    amount: payment.amount,
                    date: payment.paidAt,
                    status:
                        payment.refundedAt === undefined
                            ? ("paid" as const)
                            : ("refunded" as const),
                    invoiceUrl: checkout?.invoiceUrl,
                };
            }),
        );
    },
});

/** Derive the latest continuous coverage from non-refunded annual payments. */
export async function paidTerm(ctx: Pick<QueryCtx, "db">, subjectId: Doc<"payments">["subjectId"]) {
    // read annual payments for the purchased subject
    const payments = await ctx.db
        .query("payments")
        .withIndex("by_subject", (q) => q.eq("subjectId", subjectId))
        .collect();
    let term: { startsAt: number; endsAt: number } | null = null;

    // order retained payments before calculating successive annual terms
    const retained = payments
        .filter((payment) => payment.refundedAt === undefined)
        .sort(
            (left, right) => left.paidAt - right.paidAt || left._creationTime - right._creationTime,
        );

    // recompute renewals from payment dates so refunds never corrupt another purchase
    for (const payment of retained) {
        const start = Math.max(payment.paidAt, term?.endsAt ?? payment.paidAt);
        term = {
            startsAt: term && term.endsAt >= payment.paidAt ? term.startsAt : payment.paidAt,
            endsAt: annualEnd(start),
        };
    }

    return term;
}

/** Record one annual payment, rejecting duplicate invoice or checkout references. */
export async function recordPayment(
    ctx: MutationCtx,
    payment: Omit<Doc<"payments">, "_id" | "_creationTime" | "refundedAt">,
) {
    // require a bounded payment reference
    const reference = payment.reference.trim();
    if (!reference || reference.length > 160)
        throw new Error("Enter a payment reference up to 160 characters.");

    // reject duplicate invoice and checkout references
    const existing = await ctx.db
        .query("payments")
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .unique();
    if (existing) throw new Error("This payment has already been recorded.");

    return await ctx.db.insert("payments", { ...payment, reference });
}

/** Calculate the next calendar anniversary, clamping leap day to February 28. */
function annualEnd(start: number): number {
    // advance to the same calendar date next year
    const date = new Date(start);
    const month = date.getUTCMonth();
    date.setUTCFullYear(date.getUTCFullYear() + 1);
    if (date.getUTCMonth() !== month) date.setUTCDate(0);

    return date.getTime();
}
