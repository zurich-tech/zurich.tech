import { visibility } from "./visibility";
import { affiliations } from "../members/affiliations";
import { recurrence } from "./recurrence";
import { defineTable } from "convex/server";
import { v } from "convex/values";
import {
    addressAccess,
    registration,
    format,
    submissionFields,
    confirmation,
    participationFields,
} from "./fields";

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
    /** Default public organiser, independent of editing permissions. */
    primaryOrganiserId: v.optional(v.id("members")),
    coOrganiserIds: v.optional(v.array(v.id("members"))),
    announcedAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("proposed"), v.literal("archived")),
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    topics: v.array(v.string()),
}).index("by_slug", ["slug"]);

/** Private series edits awaiting publication. */
export const seriesRevisions = defineTable({
    primaryOrganiserId: v.optional(v.id("members")),
    coOrganiserIds: v.optional(v.array(v.id("members"))),
    seriesId: v.id("series"),
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    topics: v.array(v.string()),
    updatedAt: v.number(),
}).index("by_series", ["seriesId"]);

/** Stored events. */
export const events = defineTable({
    visibility: v.optional(visibility),
    /** Override the series public organiser for this event. */
    primaryOrganiserId: v.optional(v.id("members")),
    coOrganiserIds: v.optional(v.array(v.id("members"))),
    ...participationFields,
    announcedAt: v.optional(v.number()),
    reminderStartsAt: v.optional(v.number()),
    confirmation: v.optional(confirmation),
    confirmedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    scheduleId: v.optional(v.id("schedules")),
    occurrence: v.optional(v.string()),
    number: v.optional(v.number()),
    ownerId: v.id("members"),
    registration,
    seriesId: v.optional(v.id("series")),
    organisationIds: v.optional(v.array(v.id("organisations"))),
    partnerIds: v.optional(v.array(v.id("organisations"))),
    topics: v.array(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    slug: v.string(),
    status: eventStatus,
    format,
    venueId: v.optional(v.id("venues")),
    location: v.optional(v.string()),
    address: v.optional(v.string()),
    addressAccess: v.optional(addressAccess),
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
    .index("by_series", ["seriesId"])
    .index("by_schedule_and_occurrence", ["scheduleId", "occurrence"])
    .index("by_status_and_start", ["status", "startsAt"]);

/** Event templates and bounded automatic recurrence. */
export const schedules = defineTable({
    seriesId: v.id("series"),
    ownerId: v.id("members"),
    status: v.union(v.literal("active"), v.literal("paused")),
    publication: v.union(v.literal("draft"), v.literal("published")),
    recurrence,
    template: v.object(submissionFields),
    nextNumber: v.optional(v.number()),
    errors: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_status", ["status"])
    .index("by_series", ["seriesId"]);

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
    isRemoved: v.optional(v.boolean()),
    eventId: v.id("events"),
    memberId: v.optional(v.id("members")),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    imageDarkUrl: v.optional(v.string()),
    affiliations: v.optional(affiliations),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_event", ["eventId"])
    .index("by_event_and_position", ["eventId", "position"])
    .index("by_member", ["memberId"]);

/** Private responses about an event or a particular speaking appearance. */
export const feedback = defineTable({
    eventId: v.id("events"),
    speakerId: v.optional(v.id("speakers")),
    registrationId: v.id("registrations"),
    rating: v.optional(v.number()),
    comment: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_event", ["eventId"])
    .index("by_registration", ["registrationId"])
    .index("by_speaker", ["speakerId"]);

/** Stored submissions. */
export const submissions = defineTable({
    ownerId: v.id("members"),
    eventId: v.optional(v.id("events")),
    status: v.union(v.literal("draft"), v.literal("published")),
    ...submissionFields,
    updatedAt: v.number(),
})
    .index("by_owner", ["ownerId"])
    .index("by_event", ["eventId"])
    .index("by_series", ["seriesId"])
    .index("by_status", ["status"]);

/** Stored registrations. */
export const registrations = defineTable({
    checkInToken: v.optional(v.string()),
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
    .index("by_check_in_token", ["checkInToken"])
    .index("by_token", ["token"]);

/** Stored photos. */
const photoFields = {
    eventId: v.id("events"),
    uploaderId: v.id("members"),
    status: mediaStatus,
    position: v.number(),
    width: v.number(),
    height: v.number(),
    alt: v.optional(v.string()),
    caption: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
};

export const photos = defineTable(
    v.union(
        v.object({ ...photoFields, key: v.string(), thumbnailKey: v.string() }),
        v.object({ ...photoFields, storageId: v.id("_storage"), thumbnailId: v.id("_storage") }),
    ),
)
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
