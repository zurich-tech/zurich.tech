import { ConvexError } from "convex/values";
import { refreshRecognition } from "../sponsorships/recognition";
import { query, type MutationCtx } from "../_generated/server";
import { requireAccount } from "../auth/access";
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
                if (payment.paidAt === undefined) throw new Error("member payment date is missing");
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

/** Record one payment, rejecting duplicate invoice or checkout references. */
export async function recordPayment(
    ctx: MutationCtx,
    payment: Omit<Doc<"payments">, "_id" | "_creationTime" | "refundedAt">,
) {
    // require a receipt date or an explicit invoice confirmation
    if (payment.paidAt === undefined && (!payment.invoiceId || !payment.confirmation?.trim()))
        throw new ConvexError("enter a receipt date or invoice payment confirmation");

    // require a bounded payment reference
    const reference = payment.reference.trim();
    if (!reference || reference.length > 160)
        throw new ConvexError("Enter a payment reference up to 160 characters.");

    // reject duplicate invoice and checkout references
    const existing = await ctx.db
        .query("payments")
        .withIndex("by_reference", (q) => q.eq("reference", reference))
        .unique();
    if (existing) throw new ConvexError("This payment has already been recorded.");

    const id = await ctx.db.insert("payments", { ...payment, reference });
    const sponsorshipId = ctx.db.normalizeId("sponsorships", payment.subjectId);
    if (sponsorshipId) await refreshRecognition(ctx, sponsorshipId);
    return id;
}
