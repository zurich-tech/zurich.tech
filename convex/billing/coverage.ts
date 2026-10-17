import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

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
            endsAt:
                payment.durationDays === undefined
                    ? termEnd(start, months)
                    : start + payment.durationDays * 86400000,
        };
    }

    return term;
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
