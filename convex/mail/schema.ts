import { defineTable } from "convex/server";
import { v } from "convex/values";
import { audience, category, content, recipient } from "./model";

/** Durable messages, including unsent and terminal failures. */
export const messages = defineTable({
    key: v.string(),
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
    status: v.union(
        v.literal("queued"),
        v.literal("accepted"),
        v.literal("failed"),
        v.literal("skipped"),
    ),
    isBulk: v.boolean(),
    isTest: v.optional(v.boolean()),
    campaignId: v.optional(v.id("campaigns")),
    claimedAt: v.optional(v.number()),
    firstAttemptAt: v.optional(v.number()),
    nextAttemptAt: v.number(),
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
    /** Provider acceptance time for messages included in daily delivery health cohorts. */
    sentAt: v.optional(v.number()),
    subscriptionId: v.optional(v.id("subscriptions")),
    category: v.optional(category),
    eventId: v.optional(v.id("events")),
    registrationId: v.optional(v.id("registrations")),
    startsAt: v.optional(v.number()),
    unsubscribeToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
})
    .index("by_provider", ["providerId"])
    .index("by_recipient", ["to"])
    .index("by_due", ["isBulk", "status", "nextAttemptAt"])
    .index("by_campaign", ["campaignId"])
    .index("by_campaign_due", ["campaignId", "isBulk", "status", "nextAttemptAt"])
    .index("by_key", ["key"])
    .index("by_event_and_category", ["eventId", "category"])
    .index("by_status", ["status"]);

/** Daily bulk acceptance cohorts; late complaints belong to the original sending day. */
export const mailHealth = defineTable({
    date: v.string(),
    sent: v.number(),
    complained: v.number(),
}).index("by_date", ["date"]);

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
    /** Latest successful non-test attempt, independent of newsletter consent. */
    deliveredAt: v.optional(v.number()),
    /** Whether any non-test delivery has failed or received an adverse report. */
    hasDeliveryFailure: v.optional(v.boolean()),
    weekly: v.optional(v.boolean()),
    announcements: v.optional(v.boolean()),
    reminders: v.optional(v.boolean()),
    followUps: v.optional(v.boolean()),
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

/** Weekly schedule state; missing schedules are paused. */
export const mailSchedules = defineTable({
    isPaused: v.boolean(),
    lastWeek: v.optional(v.string()),
});

/** Sending policy, independent of quota and campaign progress. */
export const mailPolicy = defineTable({
    /** Whether historical message outcomes have been indexed for audience review. */
    isHistoryReady: v.optional(v.boolean()),
    isPaused: v.boolean(),
    pauseReason: v.optional(v.string()),
    /** Zurich calendar day explicitly approved for bulk delivery. */
    approvedDate: v.optional(v.string()),
    /** Maximum total attempts released on that day, including retries. */
    approvedLimit: v.optional(v.number()),
});

/**
 * Shared quota and health counters; pausing does not replenish quota.
 *
 * The daily ceiling is reviewed explicitly and halved by health stops.
 */
export const mailQuota = defineTable({
    date: v.string(),
    count: v.number(),
    nextAt: v.number(),
    ceiling: v.number(),
    /** Explicit hourly pace; older quotas retain their original eight-hour pacing. */
    hourlyLimit: v.optional(v.number()),
    stoppedOn: v.optional(v.string()),
    accepted: v.number(),
    bounced: v.number(),
    complained: v.number(),
});

/** Written or product-generated group send, frozen when sending starts. */
export const campaigns = defineTable({
    /** Exact message identities admitted from an existing queue by the latest review. */
    reviewedBatch: v.optional(
        v.object({
            messages: v.array(v.id("messages")),
            source: v.string(),
            /** Accepted messages awaiting provider outcomes from earlier reviews. */
            pending: v.optional(v.array(v.id("messages"))),
        }),
    ),
    /** Cumulative attempt allowance for explicitly reviewed batches, including retries. */
    attemptLimit: v.optional(v.number()),
    /** Attempts consumed against the campaign allowance. */
    attempts: v.optional(v.number()),
    eventIds: v.optional(v.array(v.id("events"))),
    key: v.optional(v.string()),
    subject: v.string(),
    message: v.string(),
    audience: v.optional(audience),
    category: v.optional(category),
    content: v.optional(content),
    eventId: v.optional(v.id("events")),
    seriesId: v.optional(v.id("series")),
    authorId: v.optional(v.id("accounts")),
    status: v.union(
        v.literal("draft"),
        v.literal("scheduled"),
        v.literal("queued"),
        v.literal("paused"),
        v.literal("completed"),
        v.literal("cancelled"),
    ),
    pauseReason: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    startsAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    recipients: v.optional(v.array(recipient)),
    cursor: v.optional(v.number()),
    finished: v.optional(v.number()),
    accepted: v.optional(v.number()),
    delivered: v.optional(v.number()),
    failed: v.optional(v.number()),
    skipped: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_key", ["key"])
    .index("by_event", ["eventId"])
    .index("by_series", ["seriesId"])
    .index("by_schedule", ["status", "scheduledAt"]);

/** Signed provider reports, distinct from provider acceptance. */
export const deliveryEvents = defineTable({
    providerEventId: v.string(),
    providerId: v.string(),
    bounceType: v.optional(v.string()),
    type: v.string(),
    receivedAt: v.number(),
})
    .index("by_provider_event", ["providerEventId"])
    .index("by_message", ["providerId"]);
