import { demographics, surveyQuestion } from "../members/demographics";
import { surveyReview } from "../members/reviews";
import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Whether the authenticated identity may access the site. */
const accountStatus = v.union(v.literal("active"), v.literal("disabled"));

/** Stored accounts. */
export const accounts = defineTable({
    authId: v.string(),
    demographics: v.optional(demographics),
    interests: v.optional(v.array(v.string())),
    motivations: v.optional(v.array(v.string())),
    participation: v.optional(v.array(v.string())),
    onboardedAt: v.optional(v.number()),
    /** Questions saved or explicitly skipped in the guided survey. */
    surveyVisited: v.optional(v.array(surveyQuestion)),
    surveyReviews: v.optional(v.array(surveyReview)),
    /** Explicitly finishing the survey is distinct from dismissing onboarding. */
    surveyCompletedAt: v.optional(v.number()),
    isTeam: v.boolean(),
    isAdmin: v.boolean(),
    /** Explicit permission to send event email; absent means no permission. */
    isMailSender: v.optional(v.boolean()),
    memberId: v.id("members"),
    status: accountStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_member", ["memberId"])
    .index("by_auth", ["authId"]);

/** Scoped content authority, independent of public membership. */
export const accessGrants = defineTable({
    accountId: v.id("accounts"),
    role: v.union(v.literal("editor"), v.literal("organiser")),
    scope: v.union(
        v.object({ kind: v.literal("event"), id: v.id("events") }),
        v.object({ kind: v.literal("series"), id: v.id("series") }),
    ),
    updatedAt: v.number(),
}).index("by_account", ["accountId"]);

/** Access changes attributed to the administrator who made them. */
export const accessChanges = defineTable({
    actorId: v.id("accounts"),
    accountId: v.id("accounts"),
    action: v.string(),
    detail: v.string(),
    createdAt: v.number(),
});
