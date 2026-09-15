import { defineTable } from "convex/server";
import { v } from "convex/values";
import { contribution } from "./contributions";
import { tier, personalTier } from "../billing/purchases";

/** Recognition and contribution terms shared by every sponsor. */
const agreement = {
    recognitionAt: v.optional(v.number()),
    billingEmail: v.optional(v.string()),
    isRenewalRequested: v.optional(v.boolean()),
    status: v.union(
        v.literal("requested"),
        v.literal("active"),
        v.literal("declined"),
        v.literal("ended"),
    ),
    note: v.optional(v.string()),
    isPublic: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
};

/** A member selects personal support; an organisation selects a company package. */
export const sponsorships = defineTable(
    v.union(
        v.object({
            ...agreement,
            organisationId: v.id("organisations"),
            tier,
            recognition: v.optional(tier),
        }),
        v.object({
            ...agreement,
            memberId: v.id("members"),
            tier: personalTier,
            recognition: v.optional(personalTier),
        }),
    ),
)
    .index("by_organisation", ["organisationId"])
    .index("by_member", ["memberId"])
    .index("by_status", ["status"]);

/** Retain each agreed period and its revisions independently of billing. */
export const sponsorshipTerms = defineTable({
    sponsorshipId: v.id("sponsorships"),
    tier,
    contribution,
    startsAt: v.number(),
    endsAt: v.number(),
    publishedAt: v.optional(v.number()),
    reason: v.string(),
    recordedBy: v.id("members"),
    createdAt: v.number(),
    replacesId: v.optional(v.id("sponsorshipTerms")),
    supersededAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    endedBy: v.optional(v.id("members")),
    endReason: v.optional(v.string()),
    endedRecordedAt: v.optional(v.number()),
}).index("by_sponsorship", ["sponsorshipId"]);
