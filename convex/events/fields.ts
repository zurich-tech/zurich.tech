import type { Doc } from "../_generated/dataModel";
import { v, type Infer } from "convex/values";

/** Supported ways to gather in the community. */
export const format = v.union(
    v.literal("meetup"),
    v.literal("talk"),
    v.literal("dinner"),
    v.literal("workshop"),
    v.literal("hackathon"),
    v.literal("office_hours"),
    v.literal("other"),
);

/** A registration policy, independent of the event's publication state. */
export const registration = v.union(
    v.object({ kind: v.literal("none") }),
    v.object({
        kind: v.literal("external"),
        url: v.string(),
        capacity: v.optional(v.number()),
    }),
    v.object({
        kind: v.literal("native"),
        admission: v.union(v.literal("automatic"), v.literal("approval")),
        capacity: v.union(v.number(), v.null()),
        overflow: v.union(v.literal("waitlist"), v.literal("closed")),
        closesAt: v.optional(v.number()),
        questions: v.array(v.object({ label: v.string(), isRequired: v.boolean() })),
    }),
);

/** Supported registration methods and their admission settings. */
export type Registration = Infer<typeof registration>;

/** Capacity and overflow rules used to resolve an approved attendee’s seat. */
export type SeatPolicy = Pick<Extract<Registration, { kind: "native" }>, "capacity" | "overflow">;

/** Resolve an eligible applicant's seat without exceeding capacity. */
export function resolveSeat(policy: SeatPolicy, confirmed: number): "going" | "waitlist" {
    if (policy.capacity === null || confirmed < policy.capacity) return "going";
    if (policy.overflow === "closed") throw new Error("This event is full.");

    return "waitlist";
}

/** Requirements for a published event to happen. */
export const confirmation = v.object({
    minimum: v.optional(v.number()),
    isApprovalRequired: v.boolean(),
    timing: v.union(v.literal("immediate"), v.literal("deadline")),
    decidesAt: v.number(),
});
export type Confirmation = Infer<typeof confirmation>;

/** Independent attendance and follow-up policies carried by each occurrence. */
export const participationFields = {
    venueCapacity: v.optional(v.number()),
    checkIn: v.optional(v.object({ isEnabled: v.boolean() })),
    feedback: v.optional(v.object({ isEventEnabled: v.boolean(), isSpeakerEnabled: v.boolean() })),
    followUp: v.optional(v.object({ isEnabled: v.boolean(), delayHours: v.number() })),
};

/** Fields an organiser may edit before publication. */
export const submissionFields = {
    primaryOrganiserId: v.optional(v.id("members")),
    coOrganiserIds: v.optional(v.array(v.id("members"))),
    ...participationFields,
    confirmation: v.optional(confirmation),
    /** Retained only to read legacy records during migration. */
    organiserIds: v.optional(v.array(v.id("members"))),
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    summary: v.optional(v.string()),
    format,
    seriesId: v.optional(v.id("series")),
    topics: v.array(v.string()),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    location: v.string(),
    address: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    registration,
    organisations: v.array(v.id("organisations")),
    partnerIds: v.optional(v.array(v.id("organisations"))),
    speakers: v.array(
        v.object({
            id: v.optional(v.id("speakers")),
            memberId: v.optional(v.id("members")),
            name: v.string(),
            title: v.string(),
            links: v.optional(v.array(v.string())),
            imageUrl: v.optional(v.string()),
            imageDarkUrl: v.optional(v.string()),
        }),
    ),
    agenda: v.array(v.object({ time: v.string(), title: v.string() })),
};

/** Authored event details shared by publication and generated drafts. */
export function eventFields(draft: Pick<Doc<"submissions">, keyof typeof submissionFields>) {
    return {
        primaryOrganiserId: draft.primaryOrganiserId,
        coOrganiserIds: draft.coOrganiserIds,
        title: draft.title,
        slug: draft.slug,
        description: draft.description,
        summary: draft.summary,
        format: draft.format,
        seriesId: draft.seriesId,
        topics: draft.topics,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        location: draft.location,
        address: draft.address,
        latitude: draft.latitude,
        longitude: draft.longitude,
        registration: draft.registration,
        venueCapacity: draft.venueCapacity,
        checkIn: draft.checkIn,
        feedback: draft.feedback,
        followUp: draft.followUp,
        confirmation: draft.confirmation,
        organisationIds: draft.organisations,
        partnerIds: draft.partnerIds,
    };
}
