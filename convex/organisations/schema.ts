import { organisationKind } from "./kinds";
import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Stored organisations. */
export const organisations = defineTable({
    /** The organisation operating this community, independent of sponsorship. */
    isHost: v.optional(v.boolean()),
    /** Member allowed to manage this organisation and its purchases. */
    ownerId: v.optional(v.id("members")),
    logoUrl: v.optional(v.string()),
    /** Optional logo for dark backgrounds. */
    logoDarkUrl: v.optional(v.string()),
    /** Compact symbol used for geographic markers. */
    mapLogoUrl: v.optional(v.string()),
    mapLogoDarkUrl: v.optional(v.string()),
    slug: v.string(),
    name: v.string(),
    headline: v.optional(v.string()),
    description: v.string(),
    kind: organisationKind,
    /** Catalogue subjects assigned to this organisation, absent on legacy records. */
    topics: v.optional(v.array(v.string())),
    website: v.string(),
    location: v.string(),
    updatedAt: v.number(),
})
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"]);
