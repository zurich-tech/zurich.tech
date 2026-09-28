import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Observed daily totals; imported history can supply only known measurements. */
export const statistics = defineTable({
    date: v.string(),
    members: v.optional(v.number()),
    subscribers: v.optional(v.number()),
    events: v.optional(v.number()),
    registrations: v.optional(v.number()),
    sponsors: v.optional(v.number()),
    organisations: v.optional(v.number()),
}).index("by_date", ["date"]);

/** Administrator-registered campaign links; never personalised to a recipient. */
export const referrals = defineTable({
    /** Public destination without a query string. */
    path: v.string(),
    /** Campaign source, such as newsletter or linkedin. */
    source: v.string(),
    /** Delivery medium, such as email or social. */
    medium: v.string(),
    /** Shared campaign label. */
    campaign: v.string(),
}).index("by_link", ["path", "source", "medium", "campaign"]);

/** Daily campaign arrival counts without visitor records. */
export const arrivals = defineTable({
    /** Zurich calendar day. */
    date: v.string(),
    /** Registered campaign link. */
    referralId: v.id("referrals"),
    /** Page loads, not unique visitors. */
    count: v.number(),
}).index("by_date_referral", ["date", "referralId"]);
