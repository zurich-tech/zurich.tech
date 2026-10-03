import { v, type Infer } from "convex/values";

/** Select recipients independently of message intent. */
export const audience = v.union(
    v.object({
        kind: v.literal("subscribers"),
        /** Require a previous registration in this series. */
        seriesId: v.optional(v.id("series")),
        /** Exclude active registrations for this event. */
        excludeEventId: v.optional(v.id("events")),
        /** Require successful delivery since this timestamp, without adverse history. */
        deliveredSince: v.optional(v.number()),
    }),
    v.object({
        kind: v.literal("registrations"),
        eventId: v.id("events"),
        status: v.union(
            v.literal("going"),
            v.literal("waitlist"),
            v.literal("active"),
            v.literal("attended"),
        ),
    }),
);
export type Audience = Infer<typeof audience>;

/** Apply consent and expiry rules according to product intent. */
export const category = v.union(
    v.literal("campaign"),
    v.literal("weekly"),
    v.literal("announcement"),
    v.literal("reminder"),
    v.literal("followup"),
    v.literal("update"),
    v.literal("confirmed"),
    v.literal("cancelled"),
);
export type Category = Infer<typeof category>;

/** Snapshot rendered template content before materialising recipient messages. */
export const content = v.object({
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
    /** Personalise only explicitly requested attendance references. */
    attendance: v.optional(
        v.union(
            v.object({ kind: v.literal("invitation"), eventId: v.id("events") }),
            v.object({ kind: v.literal("resources"), since: v.number(), until: v.number() }),
        ),
    ),
});
export type Content = Infer<typeof content>;

/** Retain source identities in a frozen, deduplicated audience. */
export const recipient = v.union(v.id("subscriptions"), v.id("registrations"));
export type Recipient = Infer<typeof recipient>;
