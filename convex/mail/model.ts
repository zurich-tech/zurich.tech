import { v, type Infer } from "convex/values";

/** Select recipients independently of message intent. */
export const audience = v.union(
    v.object({ kind: v.literal("subscribers") }),
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
});
export type Content = Infer<typeof content>;

/** Retain source identities in a frozen, deduplicated audience. */
export const recipient = v.union(v.id("subscriptions"), v.id("registrations"));
export type Recipient = Infer<typeof recipient>;
