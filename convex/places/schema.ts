import { defineTable } from "convex/server";
import { v } from "convex/values";

import { localityFields } from "./fields";

/** Stored addresses. */
export const addresses = defineTable({
    label: v.optional(v.string()),
    line1: v.string(),
    line2: v.optional(v.string()),
    postalCode: v.optional(v.string()),
    ...localityFields,
    region: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
}).index("by_country_and_locality", ["countryCode", "locality"]);

/** Stored venues. */
export const venues = defineTable({
    addressId: v.id("addresses"),
    status: v.union(v.literal("active"), v.literal("paused")),
    name: v.string(),
    accessNotes: v.optional(v.string()),
    capacity: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_address", ["addressId"])
    .index("by_status", ["status"]);

/** Stored locations. */
export const locations = defineTable({
    ownerId: v.union(v.id("organisations"), v.id("members")),
    visibility: v.union(v.literal("private"), v.literal("public")),
    addressId: v.id("addresses"),
    name: v.string(),
    /** FUGU #Cleanup: legacy curation flag, removed by migrations/locations.ts; delete once it has run on production. */
    isCurated: v.optional(v.boolean()),
})
    .index("by_owner", ["ownerId"])
    .index("by_address", ["addressId"]);
