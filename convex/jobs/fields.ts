import { localityFields } from "../places/fields";
import { v, type Infer } from "convex/values";

/** A declared range; an omitted endpoint is unknown, not zero. */
export const range = v.object({ min: v.optional(v.number()), max: v.optional(v.number()) });

/** Vacancy fields shared by the published job and its pending revision. */
export const jobFields = {
    organisationId: v.id("organisations"),
    title: v.string(),
    slug: v.string(),
    summary: v.string(),
    description: v.string(),
    locations: v.array(v.object(localityFields)),
    workplace: v.union(v.literal("onsite"), v.literal("hybrid"), v.literal("remote")),
    remoteEligibility: v.optional(v.string()),
    engagement: v.union(
        v.literal("employment"),
        v.literal("internship"),
        v.literal("apprenticeship"),
        v.literal("freelance"),
    ),
    duration: v.optional(
        v.union(
            v.object({ kind: v.literal("permanent") }),
            v.object({ kind: v.literal("fixed"), months: v.optional(v.number()) }),
        ),
    ),
    workload: v.optional(range),
    compensation: v.optional(
        v.object({
            salary: v.optional(
                v.object({
                    currency: v.string(),
                    period: v.union(
                        v.literal("year"),
                        v.literal("month"),
                        v.literal("day"),
                        v.literal("hour"),
                    ),
                    amount: range,
                    basis: v.union(v.literal("full-time"), v.literal("workload")),
                }),
            ),
            equity: v.optional(range),
        }),
    ),
    topics: v.array(v.string()),
    skills: v.array(v.string()),
    seniority: v.optional(
        v.union(v.literal("junior"), v.literal("mid"), v.literal("senior"), v.literal("lead")),
    ),
    languages: v.array(v.string()),
    visaSponsorship: v.optional(v.boolean()),
    application: v.union(
        v.object({ kind: v.literal("url"), url: v.string() }),
        v.object({ kind: v.literal("email"), email: v.string(), subject: v.optional(v.string()) }),
    ),
    applicationDeadline: v.optional(v.number()),
};

/** Editable job, independent of publication and payment. */
export type Job = Infer<ReturnType<typeof v.object<typeof jobFields>>>;

/** Number of milliseconds an employer may leave a vacancy unconfirmed. */
export const confirmationPeriod = 90 * 86400000;
