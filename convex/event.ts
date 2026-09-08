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

/** Fields an organiser may edit before publication. */
export const submissionFields = {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    format,
    seriesId: v.optional(v.id("series")),
    topics: v.array(v.string()),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    location: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    registration,
    organisations: v.array(v.id("organisations")),
    speakers: v.array(
        v.object({ name: v.string(), title: v.string(), links: v.optional(v.array(v.string())) }),
    ),
    agenda: v.array(v.object({ time: v.string(), title: v.string() })),
};
