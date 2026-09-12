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
