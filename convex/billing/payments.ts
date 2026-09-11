import { query } from "../_generated/server";
import { requireAccount } from "../auth/access";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

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

/** Derive the latest continuous coverage from non-refunded payments. */
export async function paidTerm(
    ctx: Pick<QueryCtx, "db">,
    subjectId: Doc<"payments">["subjectId"],
    months = 12,
) {
    // read payments for the purchased subject
    const payments = await ctx.db
        .query("payments")
        .withIndex("by_subject", (q) => q.eq("subjectId", subjectId))
        .collect();
    let term: { startsAt: number; endsAt: number } | null = null;

    // order retained payments before calculating successive paid terms
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
            endsAt: termEnd(start, months),
        };
    }

    return term;
}

/** Record one payment, rejecting duplicate invoice or checkout references. */
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

/** Advance by calendar months, clamping to the last day of the target month. */
function termEnd(start: number, months: number): number {
    // find the target month's last day before restoring the original day where possible
    const date = new Date(start);
    const day = date.getUTCDate();
    date.setUTCMonth(date.getUTCMonth() + months + 1, 0);
    date.setUTCDate(Math.min(day, date.getUTCDate()));

    return date.getTime();
}
