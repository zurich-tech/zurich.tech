import { v } from "convex/values";

/** Publishable job fields, also retained as a separate editorial draft. */
export const jobFields = {
    organisationId: v.id("organisations"),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    location: v.string(),
    workplace: v.union(v.literal("onsite"), v.literal("hybrid"), v.literal("remote")),
    employment: v.union(
        v.literal("full-time"),
        v.literal("part-time"),
        v.literal("contract"),
        v.literal("internship"),
    ),
    salary: v.optional(
        v.object({
            min: v.number(),
            max: v.number(),
            period: v.union(v.literal("year"), v.literal("hour")),
        }),
    ),
    tags: v.array(v.string()),
    applicationUrl: v.string(),
    billingEmail: v.string(),
};
/** Number of milliseconds an employer may leave a vacancy unconfirmed. */
export const confirmationPeriod = 90 * 86400000;
