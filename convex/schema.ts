import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const accountStatus = v.union(v.literal("active"), v.literal("disabled"));

const attendanceMethod = v.union(v.literal("qr"), v.literal("manual"), v.literal("import"));

const checkInStatus = v.union(v.literal("active"), v.literal("revoked"));

const calendarEntrySource = v.union(v.literal("event"), v.literal("manual"), v.literal("external"));

const calendarEntryStatus = v.union(
    v.literal("draft"),
    v.literal("published"),
    v.literal("cancelled"),
);

const emailKind = v.union(
    v.literal("transactional"),
    v.literal("notification"),
    v.literal("broadcast"),
);

const emailStatus = v.union(
    v.literal("queued"),
    v.literal("sent"),
    v.literal("failed"),
    v.literal("cancelled"),
);

const eventActivationKind = v.union(
    v.literal("minimum_rsvps"),
    v.literal("minimum_capacity_ratio"),
);

const eventActivationStatus = v.union(v.literal("pending"), v.literal("met"), v.literal("missed"));

const eventFormat = v.union(
    v.literal("meetup"),
    v.literal("talk"),
    v.literal("workshop"),
    v.literal("hackathon"),
    v.literal("office_hours"),
    v.literal("other"),
);

const eventStatus = v.union(
    v.literal("draft"),
    v.literal("scheduled"),
    v.literal("conditional"),
    v.literal("cancelled"),
    v.literal("finished"),
);

const feedbackVisibility = v.union(v.literal("team"), v.literal("public"));

const handleStatus = v.union(v.literal("active"), v.literal("reserved"), v.literal("released"));

const linkKind = v.union(
    v.literal("website"),
    v.literal("github"),
    v.literal("linkedin"),
    v.literal("x"),
    v.literal("mastodon"),
    v.literal("youtube"),
    v.literal("newsletter"),
    v.literal("other"),
);

const memberRole = v.union(v.literal("team"), v.literal("admin"));

const memberStatus = v.union(
    v.literal("imported"),
    v.literal("active"),
    v.literal("paused"),
    v.literal("blocked"),
    v.literal("deleted"),
);

const mediaKind = v.union(v.literal("image"));

const mediaStatus = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"));

const notificationKind = v.union(v.literal("event_reminder"), v.literal("member_notice"));

const notificationStatus = v.union(
    v.literal("scheduled"),
    v.literal("sent"),
    v.literal("cancelled"),
    v.literal("failed"),
);

const rsvpStatus = v.union(v.literal("going"), v.literal("waitlist"), v.literal("cancelled"));

const subscriptionStatus = v.union(
    v.literal("subscribed"),
    v.literal("unsubscribed"),
    v.literal("suppressed"),
);

const tagSubject = v.union(v.literal("article"), v.literal("event"), v.literal("member"));

export default defineSchema({
    accounts: defineTable({
        authId: v.string(),
        memberId: v.id("members"),
        status: accountStatus,
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_memberId", ["memberId"])
        .index("by_authId", ["authId"]),

    members: defineTable({
        status: memberStatus,
        name: v.string(),
        headline: v.optional(v.string()),
        bio: v.optional(v.string()),
        searchText: v.string(),
        imageId: v.optional(v.string()),
        visibility: v.union(v.literal("private"), v.literal("members"), v.literal("public")),
        source: v.optional(v.string()),
        importedAt: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_status", ["status"])
        .searchIndex("search_text", {
            searchField: "searchText",
            filterFields: ["status", "visibility"],
        }),

    memberEmails: defineTable({
        memberId: v.id("members"),
        email: v.string(),
        isPrimary: v.boolean(),
        verifiedAt: v.optional(v.number()),
        source: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_memberId", ["memberId"])
        .index("by_email", ["email"]),

    memberRoles: defineTable({
        memberId: v.id("members"),
        role: memberRole,
        createdAt: v.number(),
    })
        .index("by_memberId", ["memberId"])
        .index("by_role", ["role"])
        .index("by_memberId_and_role", ["memberId", "role"]),

    handles: defineTable({
        name: v.string(),
        subject: v.literal("member"),
        subjectId: v.id("members"),
        status: handleStatus,
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_name", ["name"])
        .index("by_subject_and_subjectId", ["subject", "subjectId"]),

    addresses: defineTable({
        label: v.optional(v.string()),
        line1: v.string(),
        line2: v.optional(v.string()),
        postalCode: v.optional(v.string()),
        locality: v.string(),
        region: v.optional(v.string()),
        countryCode: v.string(),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_countryCode_and_locality", ["countryCode", "locality"]),

    links: defineTable({
        subject: v.union(v.literal("member"), v.literal("event")),
        subjectId: v.union(v.id("members"), v.id("events")),
        kind: linkKind,
        label: v.optional(v.string()),
        url: v.string(),
        position: v.number(),
        visibility: v.union(v.literal("private"), v.literal("members"), v.literal("public")),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_subject_and_subjectId", ["subject", "subjectId"])
        .index("by_url", ["url"]),

    venues: defineTable({
        addressId: v.id("addresses"),
        status: v.union(v.literal("active"), v.literal("paused")),
        name: v.string(),
        accessNotes: v.optional(v.string()),
        capacity: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_addressId", ["addressId"])
        .index("by_status", ["status"]),

    events: defineTable({
        ownerMemberId: v.id("members"),
        slug: v.string(),
        status: eventStatus,
        format: eventFormat,
        venueId: v.optional(v.id("venues")),
        location: v.optional(v.string()),
        title: v.string(),
        description: v.optional(v.string()),
        startsAt: v.number(),
        endsAt: v.optional(v.number()),
        capacity: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_slug", ["slug"])
        .index("by_ownerMemberId", ["ownerMemberId"])
        .index("by_status_and_startsAt", ["status", "startsAt"]),

    eventActivations: defineTable({
        eventId: v.id("events"),
        kind: eventActivationKind,
        threshold: v.number(),
        deadlineAt: v.number(),
        status: eventActivationStatus,
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_status_and_deadlineAt", ["status", "deadlineAt"]),

    calendarEntries: defineTable({
        eventId: v.optional(v.id("events")),
        slug: v.string(),
        source: calendarEntrySource,
        status: calendarEntryStatus,
        title: v.string(),
        summary: v.optional(v.string()),
        searchText: v.string(),
        tags: v.array(v.string()),
        startsAt: v.number(),
        endsAt: v.optional(v.number()),
        timezone: v.string(),
        location: v.optional(v.string()),
        href: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_slug", ["slug"])
        .index("by_status_and_startsAt", ["status", "startsAt"])
        .searchIndex("search_text", { searchField: "searchText", filterFields: ["status"] }),

    eventAgendaItems: defineTable({
        eventId: v.id("events"),
        time: v.string(),
        title: v.string(),
        position: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_eventId_and_position", ["eventId", "position"]),

    eventSpeakers: defineTable({
        eventId: v.id("events"),
        memberId: v.optional(v.id("members")),
        name: v.string(),
        title: v.optional(v.string()),
        position: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_eventId_and_position", ["eventId", "position"]),

    rsvps: defineTable({
        eventId: v.id("events"),
        memberId: v.optional(v.id("members")),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        status: rsvpStatus,
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_memberId", ["memberId"])
        .index("by_eventId_and_email", ["eventId", "email"]),

    attendances: defineTable({
        eventId: v.id("events"),
        rsvpId: v.optional(v.id("rsvps")),
        memberId: v.optional(v.id("members")),
        email: v.optional(v.string()),
        checkedInByMemberId: v.optional(v.id("members")),
        checkedInAt: v.number(),
        method: attendanceMethod,
        createdAt: v.number(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_rsvpId", ["rsvpId"])
        .index("by_memberId", ["memberId"]),

    checkIns: defineTable({
        eventId: v.id("events"),
        tokenHash: v.string(),
        status: checkInStatus,
        expiresAt: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_tokenHash", ["tokenHash"]),

    eventFeedback: defineTable({
        eventId: v.id("events"),
        memberId: v.optional(v.id("members")),
        rsvpId: v.optional(v.id("rsvps")),
        rating: v.optional(v.number()),
        comment: v.optional(v.string()),
        visibility: feedbackVisibility,
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_memberId", ["memberId"]),

    articles: defineTable({
        authorMemberId: v.id("members"),
        slug: v.string(),
        status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
        title: v.string(),
        description: v.string(),
        body: v.string(),
        searchText: v.string(),
        publishedAt: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_slug", ["slug"])
        .index("by_status_and_publishedAt", ["status", "publishedAt"])
        .searchIndex("search_text", { searchField: "searchText", filterFields: ["status"] }),

    notifications: defineTable({
        subject: v.union(v.literal("event"), v.literal("member")),
        subjectId: v.union(v.id("events"), v.id("members")),
        memberId: v.optional(v.id("members")),
        email: v.optional(v.string()),
        kind: notificationKind,
        status: notificationStatus,
        scheduledAt: v.number(),
        sentAt: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_status_and_scheduledAt", ["status", "scheduledAt"])
        .index("by_memberId", ["memberId"])
        .index("by_subject_and_subjectId", ["subject", "subjectId"]),

    emails: defineTable({
        notificationId: v.optional(v.id("notifications")),
        kind: emailKind,
        status: emailStatus,
        memberId: v.optional(v.id("members")),
        to: v.string(),
        subject: v.string(),
        providerId: v.optional(v.string()),
        error: v.optional(v.string()),
        scheduledAt: v.optional(v.number()),
        sentAt: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_status_and_createdAt", ["status", "createdAt"])
        .index("by_memberId", ["memberId"])
        .index("by_notificationId", ["notificationId"]),

    subscriptions: defineTable({
        memberId: v.optional(v.id("members")),
        email: v.string(),
        topic: v.union(v.literal("newsletter"), v.literal("events")),
        status: subscriptionStatus,
        source: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_email", ["email"])
        .index("by_email_and_topic", ["email", "topic"])
        .index("by_memberId", ["memberId"])
        .index("by_topic_and_status", ["topic", "status"]),

    submissionLimits: defineTable({
        key: v.string(),
        count: v.number(),
        startedAt: v.number(),
        updatedAt: v.number(),
    }).index("by_key", ["key"]),

    tags: defineTable({
        slug: v.string(),
        name: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_slug", ["slug"]),

    taggings: defineTable({
        tagId: v.id("tags"),
        subject: tagSubject,
        subjectId: v.union(v.id("articles"), v.id("events"), v.id("members")),
        createdAt: v.number(),
    })
        .index("by_tagId", ["tagId"])
        .index("by_subject_and_subjectId", ["subject", "subjectId"]),

    media: defineTable({
        eventId: v.id("events"),
        uploadedByMemberId: v.id("members"),
        key: v.string(),
        thumbnailKey: v.string(),
        kind: mediaKind,
        status: mediaStatus,
        position: v.number(),
        width: v.number(),
        height: v.number(),
        alt: v.optional(v.string()),
        caption: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_eventId_and_position", ["eventId", "position"])
        .index("by_uploadedByMemberId", ["uploadedByMemberId"])
        .index("by_status", ["status"]),
});
