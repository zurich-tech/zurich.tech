import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Stored deliveries. */
export const deliveries = defineTable({
    key: v.string(),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
    status: v.union(
        v.literal("queued"),
        v.literal("sent"),
        v.literal("failed"),
        v.literal("skipped"),
    ),
    isBulk: v.optional(v.boolean()),
    campaignId: v.optional(v.id("campaigns")),
    claimedAt: v.optional(v.number()),
    firstAttemptAt: v.optional(v.number()),
    nextAttemptAt: v.optional(v.number()),
    outcome: v.optional(
        v.union(
            v.literal("delivered"),
            v.literal("bounced"),
            v.literal("complained"),
            v.literal("failed"),
            v.literal("suppressed"),
        ),
    ),
    error: v.optional(v.string()),
    attempts: v.number(),
    createdAt: v.number(),
    providerId: v.optional(v.string()),
    subscriptionId: v.optional(v.id("subscriptions")),
    category: v.optional(
        v.union(
            v.literal("campaign"),
            v.literal("weekly"),
            v.literal("announcement"),
            v.literal("reminder"),
            v.literal("followup"),
            v.literal("confirmed"),
            v.literal("cancelled"),
        ),
    ),
    eventId: v.optional(v.id("events")),
    registrationId: v.optional(v.id("registrations")),
    startsAt: v.optional(v.number()),
})
    .index("by_provider", ["providerId"])
    .index("by_bulk_status", ["isBulk", "status", "nextAttemptAt"])
    .index("by_campaign", ["campaignId"])
    .index("by_key", ["key"])
    .index("by_event_and_category", ["eventId", "category"])
    .index("by_status", ["status"]);

/** Weekly newsletter scheduling state. */
export const digests = defineTable({
    isPaused: v.boolean(),
    lastWeek: v.optional(v.string()),
});

/** Bulk delivery controls; missing settings mean paused. */
export const mailSettings = defineTable({
    isPaused: v.boolean(),
    profile: v.union(v.literal("new"), v.literal("established"), v.literal("complete")),
    day: v.number(),
    date: v.string(),
    count: v.number(),
    nextAt: v.number(),
    accepted: v.number(),
    bounced: v.number(),
    complained: v.number(),
    pauseReason: v.optional(v.string()),
});

/** Signed provider events, deduplicated even when delivered out of order. */
export const mailEvents = defineTable({
    providerEventId: v.string(),
    providerId: v.string(),
    bounceType: v.optional(v.string()),
    type: v.string(),
    receivedAt: v.number(),
})
    .index("by_provider_event", ["providerEventId"])
    .index("by_message", ["providerId"]);
