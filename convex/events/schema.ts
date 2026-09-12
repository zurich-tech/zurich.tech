import { defineTable } from "convex/server";
import { v } from "convex/values";
import { registration, format, submissionFields } from "./fields";

/** How physical attendance was recorded. */
const attendanceMethod = v.union(v.literal("qr"), v.literal("manual"), v.literal("import"));

/** Publication and cancellation state of an event. */
const eventStatus = v.union(
    v.literal("draft"),
    v.literal("scheduled"),
    v.literal("cancelled"),
    v.literal("finished"),
);

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

/** Stored series. */
export const series = defineTable({
    status: v.union(v.literal("active"), v.literal("proposed")),
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    topics: v.array(v.string()),
}).index("by_slug", ["slug"]);

/** Stored events. */
export const events = defineTable({
    organiserIds: v.optional(v.array(v.id("members"))),
    ownerId: v.id("members"),
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
    address: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    summary: v.optional(v.string()),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"])
    .index("by_status_and_start", ["status", "startsAt"]);

/** Stored sessions. */
export const sessions = defineTable({
    eventId: v.id("events"),
    time: v.string(),
    title: v.string(),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_event", ["eventId"])
    .index("by_event_and_position", ["eventId", "position"]);

/** Stored speakers. */
export const speakers = defineTable({
    eventId: v.id("events"),
    memberId: v.optional(v.id("members")),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    imageDarkUrl: v.optional(v.string()),
    title: v.optional(v.string()),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_event", ["eventId"])
    .index("by_event_and_position", ["eventId", "position"]);

/** Stored submissions. */
export const submissions = defineTable({
    ownerId: v.id("members"),
    eventId: v.optional(v.id("events")),
    status: v.union(v.literal("draft"), v.literal("published")),
    ...submissionFields,
    updatedAt: v.number(),
})
    .index("by_owner", ["ownerId"])
    .index("by_status", ["status"]);

/** Stored registrations. */
export const registrations = defineTable({
    source: v.optional(v.string()),
    eventId: v.id("events"),
    memberId: v.optional(v.id("members")),
    email: v.string(),
    name: v.string(),
    status: rsvpStatus,
    token: v.optional(v.string()),
    answers: v.optional(v.array(v.string())),
    /** Admission approval time; only approved attendees can leave the waitlist. */
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_event", ["eventId"])
    .index("by_member", ["memberId"])
    .index("by_event_and_email", ["eventId", "email"])
    .index("by_token", ["token"]);

/** Stored photos. */
export const photos = defineTable({
    eventId: v.id("events"),
    uploaderId: v.id("members"),
    key: v.string(),
    thumbnailKey: v.string(),
    status: mediaStatus,
    position: v.number(),
    width: v.number(),
    height: v.number(),
    alt: v.optional(v.string()),
    caption: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_event_and_position", ["eventId", "position"])
    .index("by_uploader", ["uploaderId"])
    .index("by_status", ["status"]);

/** Stored attendances. */
export const attendances = defineTable({
    eventId: v.id("events"),
    registrationId: v.optional(v.id("registrations")),
    memberId: v.optional(v.id("members")),
    email: v.optional(v.string()),
    checkedInByMemberId: v.optional(v.id("members")),
    checkedInAt: v.number(),
    method: attendanceMethod,
    createdAt: v.number(),
})
    .index("by_event", ["eventId"])
    .index("by_registrationId", ["registrationId"])
    .index("by_member", ["memberId"]);
