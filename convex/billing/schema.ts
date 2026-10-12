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
    /** Purchased coverage in days; absent for original calendar-month plans. */
    durationDays: v.optional(v.number()),
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
    invoiceId: v.optional(v.id("invoices")),
    /** Purchased membership, vacancy or sponsorship. */
    subjectId: v.union(v.id("jobs"), v.id("sponsorships")),
    memberId: v.optional(v.id("members")),
    name: v.string(),
    /** Amount in CHF, before conversion to Stripe minor units. */
    amount: v.number(),
    /** Purchased coverage in days; absent for original calendar-month plans. */
    durationDays: v.optional(v.number()),
    /** Payment acceptance time in Unix milliseconds. */
    paidAt: v.number(),
    /** Full refund time; excludes this payment from paid coverage. */
    refundedAt: v.optional(v.number()),
    /** Team member who recorded a manual payment. */
    recordedBy: v.optional(v.id("members")),
})
    .index("by_invoice", ["invoiceId"])
    .index("by_reference", ["reference"])
    .index("by_subject", ["subjectId"])
    .index("by_member", ["memberId"]);

/** Retain issued invoices and their document identity independently of receipts. */
export const invoices = defineTable({
    termId: v.id("sponsorshipTerms"),
    number: v.string(),
    reference: v.string(),
    amount: v.number(),
    issuedAt: v.number(),
    dueAt: v.number(),
    document: v.string(),
    recordedBy: v.id("members"),
    createdAt: v.number(),
    voidedAt: v.optional(v.number()),
    voidedBy: v.optional(v.id("members")),
    voidReason: v.optional(v.string()),
})
    .index("by_term", ["termId"])
    .index("by_number", ["number"])
    .index("by_reference", ["reference"]);

/** Retain each partial or full refund against its original receipt. */
export const refunds = defineTable({
    paymentId: v.id("payments"),
    amount: v.number(),
    paidAt: v.number(),
    reference: v.string(),
    reason: v.string(),
    recordedBy: v.id("members"),
    createdAt: v.number(),
})
    .index("by_payment", ["paymentId"])
    .index("by_reference", ["reference"]);
