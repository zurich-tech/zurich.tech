import { defineTable } from "convex/server";
import { v } from "convex/values";
import { jobFields } from "./fields";

/** Stored jobs. */
export const jobs = defineTable({
    ...jobFields,
    billingEmail: v.string(),
    createdBy: v.id("members"),
    updatedBy: v.id("members"),
    status: v.union(
        v.literal("draft"),
        v.literal("review"),
        v.literal("published"),
        v.literal("closed"),
    ),
    /** Unapproved changes retained without replacing the public vacancy. */
    draft: v.optional(v.object(jobFields)),
    draftStatus: v.optional(v.union(v.literal("draft"), v.literal("review"))),
    reviewNote: v.optional(v.string()),
    publishedAt: v.optional(v.number()),
    /** Most recent employer confirmation that applications remain open. */
    confirmedAt: v.optional(v.number()),
    /** Allocated sponsor job slot instead of direct job payment. */
    sponsorshipId: v.optional(v.id("sponsorships")),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_slug", ["slug"])
    .index("by_organisation", ["organisationId"])
    .index("by_status", ["status"]);
