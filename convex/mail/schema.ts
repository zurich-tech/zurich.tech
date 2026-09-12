import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Stored deliveries. */
export const deliveries = defineTable({
    key: v.string(),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
    status: v.union(v.literal("queued"), v.literal("sent"), v.literal("failed")),
    error: v.optional(v.string()),
    attempts: v.number(),
    createdAt: v.number(),
    providerId: v.optional(v.string()),
    subscriptionId: v.optional(v.id("subscriptions")),
    category: v.optional(
        v.union(v.literal("weekly"), v.literal("announcement"), v.literal("reminder")),
    ),
    eventId: v.optional(v.id("events")),
    registrationId: v.optional(v.id("registrations")),
    startsAt: v.optional(v.number()),
})
    .index("by_key", ["key"])
    .index("by_status", ["status"]);

/** Stored verifications. */
export const verifications = defineTable({
    email: v.string(),
    name: v.string(),
    eventId: v.optional(v.id("events")),
    purpose: v.union(v.literal("registration"), v.literal("subscription")),
    token: v.string(),
    /** Unsubscribe token, independent of the attendee management token. */
    newsletterToken: v.string(),
    answers: v.array(v.string()),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
}).index("by_token", ["token"]);

/** Stored limits. */
export const limits = defineTable({
    key: v.string(),
    count: v.number(),
    expiresAt: v.number(),
})
    .index("by_key", ["key"])
    .index("by_expiry", ["expiresAt"]);

/** Newsletter recipients and unsubscribe preferences. */
export const subscriptions = defineTable({
    history: v.optional(
        v.array(
            v.object({
                at: v.number(),
                status: v.union(
                    v.literal("subscribed"),
                    v.literal("unsubscribed"),
                    v.literal("suppressed"),
                ),
                weekly: v.boolean(),
                source: v.string(),
                isEstimated: v.optional(v.boolean()),
            }),
        ),
    ),
    memberId: v.optional(v.id("members")),
    email: v.string(),
    status: v.union(v.literal("subscribed"), v.literal("unsubscribed"), v.literal("suppressed")),
    token: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    weekly: v.optional(v.boolean()),
    announcements: v.optional(v.boolean()),
    reminders: v.optional(v.boolean()),
    seriesIds: v.optional(v.array(v.id("series"))),
    topics: v.optional(v.array(v.string())),
    source: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_email", ["email"])
    .index("by_member", ["memberId"])
    .index("by_status", ["status"])
    .index("by_token", ["token"]);

/** Weekly newsletter scheduling state. */
export const digests = defineTable({ isPaused: v.boolean(), lastWeek: v.optional(v.string()) });
