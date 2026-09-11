import { defineTable } from "convex/server";
import { v } from "convex/values";
import { purchaseRecord } from "./purchases";

/** Stored checkouts. */
export const checkouts = defineTable({
    memberId: v.id("members"),
    purchase: purchaseRecord,
    name: v.string(),
    email: v.string(),
    /** Amount in CHF, before conversion to Stripe minor units. */
    amount: v.number(),
    status: v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("expired"),
        v.literal("refunded"),
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
    /** Stripe session identity assigned after reservation. */
    sessionId: v.optional(v.string()),
    url: v.optional(v.string()),
    /** Stripe payment identity used to match refund webhooks. */
    paymentIntent: v.optional(v.string()),
    /** Hosted paid invoice, which may arrive after payment confirmation. */
    invoiceUrl: v.optional(v.string()),
})
    .index("by_member", ["memberId"])
    .index("by_status", ["status"])
    .index("by_session", ["sessionId"])
    .index("by_payment", ["paymentIntent"]);

/** Stored payments. */
export const payments = defineTable({
    /** Unique manual invoice reference or Stripe checkout session ID. */
    reference: v.string(),
    /** Purchased membership, vacancy or sponsorship. */
    subjectId: v.union(v.id("jobs"), v.id("sponsorships")),
    memberId: v.optional(v.id("members")),
    name: v.string(),
    /** Amount in CHF, before conversion to Stripe minor units. */
    amount: v.number(),
    /** Payment acceptance time in Unix milliseconds. */
    paidAt: v.number(),
    /** Full refund time; excludes this payment from annual coverage. */
    refundedAt: v.optional(v.number()),
    /** Team member who recorded a manual payment. */
    recordedBy: v.optional(v.id("members")),
})
    .index("by_reference", ["reference"])
    .index("by_subject", ["subjectId"])
    .index("by_member", ["memberId"]);
