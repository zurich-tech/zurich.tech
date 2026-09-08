import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { registration, format, submissionFields } from "./event";
import { purchase, tier } from "./purchase";
import { jobFields } from "./job";

/** Whether the authenticated identity may access the site. */
const accountStatus = v.union(v.literal("active"), v.literal("disabled"));

/** How physical attendance was recorded. */
const attendanceMethod = v.union(v.literal("qr"), v.literal("manual"), v.literal("import"));

/** Publication and cancellation state of an event. */
const eventStatus = v.union(
    v.literal("draft"),
    v.literal("scheduled"),
    v.literal("cancelled"),
    v.literal("finished"),
);

/** Whether a public handle resolves or remains reserved. */
const handleStatus = v.union(v.literal("active"), v.literal("reserved"), v.literal("released"));

/** Recognized public link destinations. */
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

/** Shared team permissions. */
const memberRole = v.literal("team");

/** Membership lifecycle, including imported and blocked records. */
const memberStatus = v.union(
    v.literal("imported"),
    v.literal("active"),
    v.literal("paused"),
    v.literal("blocked"),
    v.literal("deleted"),
);

/** Supported uploaded media. */
const mediaKind = v.union(v.literal("image"));

/** Moderation state of an uploaded image. */
const mediaStatus = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"));

/** Admission state of an event registration. */
const rsvpStatus = v.union(
    v.literal("going"),
    v.literal("waitlist"),
    v.literal("cancelled"),
    v.literal("pending"),
    v.literal("declined"),
);

/** Newsletter delivery eligibility and explicit suppression. */
const subscriptionStatus = v.union(
    v.literal("subscribed"),
    v.literal("unsubscribed"),
    v.literal("suppressed"),
);

/** Member profiles are the only records using tag assignments. */
const tagSubject = v.literal("member");

export default defineSchema({
    /** Hosted payment sessions, separate from recorded annual payments. */
    checkouts: defineTable({
        memberId: v.id("members"),
        purchase,
        name: v.string(),
        email: v.string(),
        /** Amount in CHF, before conversion to Stripe minor units. */
        amount: v.number(),
        status: v.union(
            v.literal("pending"),
            v.literal("paid"),
            v.literal("expired"),
            v.literal("refunded"),
        ),
        createdAt: v.number(),
        expiresAt: v.number(),
        /** Stripe session identity assigned after reservation. */
        sessionId: v.optional(v.string()),
        url: v.optional(v.string()),
        /** Stripe payment identity used to match refund webhooks. */
        paymentIntent: v.optional(v.string()),
        /** Hosted paid invoice, which may arrive after payment confirmation. */
        invoiceUrl: v.optional(v.string()),
    })
        .index("by_member", ["memberId"])
        .index("by_status", ["status"])
        .index("by_session", ["sessionId"])
        .index("by_payment", ["paymentIntent"]),
    /** Recurring event names and their shared topics. */
    series: defineTable({
        status: v.union(v.literal("active"), v.literal("proposed")),
        slug: v.string(),
        name: v.string(),
        description: v.string(),
        topics: v.array(v.string()),
    }).index("by_slug", ["slug"]),
    /** Annual payments used to derive coverage for patrons, jobs and sponsorships. */
    payments: defineTable({
        /** Unique manual invoice reference or Stripe checkout session ID. */
        reference: v.string(),
        /** Purchased membership, vacancy or sponsorship. */
        subjectId: v.union(v.id("members"), v.id("jobs"), v.id("sponsorships")),
        memberId: v.optional(v.id("members")),
        name: v.string(),
        /** Amount in CHF, before conversion to Stripe minor units. */
        amount: v.number(),
        /** Payment acceptance time in Unix milliseconds. */
        paidAt: v.number(),
        /** Full refund time; excludes this payment from annual coverage. */
        refundedAt: v.optional(v.number()),
        /** Team member who recorded a manual payment. */
        recordedBy: v.optional(v.id("members")),
    })
        .index("by_reference", ["reference"])
        .index("by_subject", ["subjectId"])
        .index("by_member", ["memberId"]),
    /** Employer vacancies with a separate unpublished revision. */
    jobs: defineTable({
        ...jobFields,
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
        .index("by_company", ["organisationId"])
        .index("by_status", ["status"]),
    /** Company sponsorship requests and recognition agreements. */
    sponsorships: defineTable({
        organisationId: v.id("organisations"),
        tier,
        billingEmail: v.string(),

        renewalRequested: v.optional(v.boolean()),
        status: v.union(
            v.literal("requested"),
            v.literal("active"),
            v.literal("declined"),
            v.literal("ended"),
        ),
        note: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_company", ["organisationId"])
        .index("by_status", ["status"]),
    /** Public organisations and the owners of their jobs and sponsorships. */
    organisations: defineTable({
        /** Member allowed to manage this organisation and its purchases. */
        ownerMemberId: v.optional(v.id("members")),
        logoUrl: v.optional(v.string()),
        slug: v.string(),
        name: v.string(),
        description: v.string(),
        kind: v.union(
            v.literal("company"),
            v.literal("lab"),
            v.literal("community"),
            v.literal("space"),
        ),
        website: v.string(),
        location: v.string(),
        updatedAt: v.number(),
    }).index("by_slug", ["slug"]),
    /** Editable event revisions awaiting publication. */
    submissions: defineTable({
        ownerMemberId: v.id("members"),
        eventId: v.optional(v.id("events")),
        status: v.union(
            v.literal("draft"),
            v.literal("review"),
            v.literal("published"),
            v.literal("declined"),
        ),
        ...submissionFields,
        reviewNote: v.optional(v.string()),
        updatedAt: v.number(),
    })
        .index("by_owner", ["ownerMemberId"])
        .index("by_status", ["status"]),
    /** Single use email verification requests. */
    tickets: defineTable({
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
    }).index("by_token", ["token"]),
    /** Durable email messages and their delivery outcomes. */
    deliveries: defineTable({
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
    })
        .index("by_key", ["key"])
        .index("by_status", ["status"]),
    /** Weekly newsletter scheduling state. */
    digest: defineTable({ isPaused: v.boolean(), lastWeek: v.optional(v.string()) }),

    /** Provider identities linked to local members and their permissions. */
    accounts: defineTable({
        authId: v.string(),
        /** Explicit permission to publish owned events without team review. */
        canPublish: v.optional(v.boolean()),
        memberId: v.id("members"),
        status: accountStatus,
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_memberId", ["memberId"])
        .index("by_authId", ["authId"]),

    /** A member’s choice of public recognition; coverage comes from payments. */
    patrons: defineTable({
        memberId: v.id("members"),
        /** Whether the member consents to public Patron recognition. */
        isPublic: v.boolean(),
    }).index("by_member", ["memberId"]),

    /** Local member profiles independent of authentication providers. */
    members: defineTable({
        status: memberStatus,
        name: v.string(),
        headline: v.optional(v.string()),
        bio: v.optional(v.string()),
        searchText: v.string(),
        imageId: v.optional(v.string()),
        avatarUrl: v.optional(v.string()),
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

    /** Email addresses used to identify and verify members. */
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

    /** Explicit team membership grants. */
    memberRoles: defineTable({
        memberId: v.id("members"),
        role: memberRole,
        createdAt: v.number(),
    })
        .index("by_memberId", ["memberId"])
        .index("by_role", ["role"])
        .index("by_memberId_and_role", ["memberId", "role"]),

    /** Reserved and active public member URLs. */
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

    /** Postal addresses and optional geographic coordinates. */
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

    /** Ordered links attached to events or members. */
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

    /** Named event venues and their postal addresses. */
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

    /** Published event content and registration policy. */
    events: defineTable({
        ownerMemberId: v.id("members"),
        registration,
        seriesId: v.optional(v.id("series")),
        organisationIds: v.optional(v.array(v.id("organisations"))),
        topics: v.array(v.string()),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        slug: v.string(),
        status: eventStatus,
        format,
        venueId: v.optional(v.id("venues")),
        location: v.optional(v.string()),
        title: v.string(),
        description: v.optional(v.string()),
        summary: v.optional(v.string()),
        startsAt: v.number(),
        endsAt: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_slug", ["slug"])
        .index("by_ownerMemberId", ["ownerMemberId"])
        .index("by_status_and_startsAt", ["status", "startsAt"]),

    /** Ordered programme entries within an event. */
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

    /** Speaker identities and social links in display order. */
    eventSpeakers: defineTable({
        eventId: v.id("events"),
        memberId: v.optional(v.id("members")),
        name: v.string(),
        links: v.optional(v.array(v.string())),
        title: v.optional(v.string()),
        position: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_eventId_and_position", ["eventId", "position"]),

    /** Verified attendee applications and allocated seats. */
    rsvps: defineTable({
        eventId: v.id("events"),
        memberId: v.optional(v.id("members")),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        status: rsvpStatus,
        token: v.optional(v.string()),
        answers: v.optional(v.array(v.string())),
        /** Admission approval time; only approved attendees can leave the waitlist. */
        approvedAt: v.optional(v.number()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_eventId", ["eventId"])
        .index("by_memberId", ["memberId"])
        .index("by_eventId_and_email", ["eventId", "email"])
        .index("by_token", ["token"]),

    /** Physical attendance records, distinct from registration. */
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

    /** Verified newsletter recipients and unsubscribe preferences. */
    subscriptions: defineTable({
        memberId: v.optional(v.id("members")),
        email: v.string(),
        status: subscriptionStatus,
        token: v.optional(v.string()),
        verifiedAt: v.optional(v.number()),
        source: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
    })
        .index("by_email", ["email"])
        .index("by_memberId", ["memberId"])
        .index("by_status", ["status"])
        .index("by_token", ["token"]),

    /** Counts within anonymous submission rate limit windows. */
    submissionLimits: defineTable({
        key: v.string(),
        count: v.number(),
        startedAt: v.number(),
        updatedAt: v.number(),
    }).index("by_key", ["key"]),

    /** Named member interests. */
    tags: defineTable({
        slug: v.string(),
        name: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
    }).index("by_slug", ["slug"]),

    /** Member interest assignments. */
    taggings: defineTable({
        tagId: v.id("tags"),
        subject: tagSubject,
        subjectId: v.id("members"),
        createdAt: v.number(),
    })
        .index("by_tagId", ["tagId"])
        .index("by_subject_and_subjectId", ["subject", "subjectId"]),

    /** Reviewed event images stored in public object storage. */
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
