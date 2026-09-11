import { defineTable } from "convex/server";
import { v } from "convex/values";
import { tier } from "../billing/purchases";

/** Recognition and contribution terms shared by every sponsor. */
const agreement = {
    billingEmail: v.optional(v.string()),
    inKind: v.optional(
        v.object({ description: v.string(), startsAt: v.number(), endsAt: v.number() }),
    ),
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

/** A member supports as a patron; an organisation selects an organisation tier. */
export const sponsorships = defineTable(
    v.union(
        v.object({ ...agreement, organisationId: v.id("organisations"), tier }),
        v.object({ ...agreement, memberId: v.id("members"), tier: v.literal("patron") }),
    ),
)
    .index("by_organisation", ["organisationId"])
    .index("by_member", ["memberId"])
    .index("by_status", ["status"]);
