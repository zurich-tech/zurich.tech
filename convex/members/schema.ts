import { affiliations } from "./affiliations";
import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Whether a public handle resolves or remains reserved. */
const handleStatus = v.union(v.literal("active"), v.literal("reserved"), v.literal("released"));

/** Membership lifecycle, including imported and blocked records. */
const memberStatus = v.union(
    v.literal("imported"),
    v.literal("active"),
    v.literal("paused"),
    v.literal("blocked"),
    v.literal("deleted"),
);

/** Stored members. */
export const members = defineTable({
    status: memberStatus,
    name: v.string(),
    headline: v.optional(v.string()),
    affiliations: v.optional(affiliations),
    bio: v.optional(v.string()),
    searchText: v.string(),
    avatarUrl: v.optional(v.string()),
    avatarId: v.optional(v.id("_storage")),
    /** Optional profile image for dark backgrounds. */
    avatarDarkUrl: v.optional(v.string()),
    visibility: v.union(v.literal("private"), v.literal("members"), v.literal("public")),
    source: v.optional(v.string()),
    importedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_status", ["status"])
    .searchIndex("search_text", {
        searchField: "searchText",
        filterFields: ["status", "visibility"],
    });

/** Stored emails. */
export const emails = defineTable({
    memberId: v.id("members"),
    email: v.string(),
    isPrimary: v.boolean(),
    verifiedAt: v.optional(v.number()),
    source: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_member", ["memberId"])
    .index("by_email", ["email"]);

/** Stored roles. */
export const roles = defineTable({
    memberId: v.id("members"),
    name: v.string(),
    organisationId: v.optional(v.id("organisations")),
    status: v.union(v.literal("active"), v.literal("former")),
    isPublic: v.boolean(),
    position: v.number(),
    createdAt: v.number(),
})
    .index("by_member", ["memberId"])
    .index("by_organisation", ["organisationId"])
    .index("by_member_and_name", ["memberId", "name"]);

/** Stored handles. */
export const handles = defineTable({
    name: v.string(),
    memberId: v.id("members"),
    status: handleStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_name", ["name"])
    .index("by_member", ["memberId"]);

/** Stored tags. */
export const tags = defineTable({
    slug: v.string(),
    name: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
}).index("by_slug", ["slug"]);

/** Stored taggings. */
export const taggings = defineTable({
    tagId: v.id("tags"),
    memberId: v.id("members"),
    createdAt: v.number(),
})
    .index("by_tag", ["tagId"])
    .index("by_member", ["memberId"]);

/** Recognized public link destinations. */
const linkKind = v.union(
    v.literal("website"),
    v.literal("profile"),
    v.literal("discord"),
    v.literal("github"),
    v.literal("linkedin"),
    v.literal("x"),
    v.literal("mastodon"),
    v.literal("youtube"),
    v.literal("newsletter"),
    v.literal("other"),
);

/** Stored links. */
export const links = defineTable({
    ownerId: v.union(v.id("members"), v.id("organisations"), v.id("events"), v.id("speakers")),
    kind: linkKind,
    label: v.optional(v.string()),
    url: v.string(),
    position: v.number(),
    visibility: v.union(v.literal("private"), v.literal("members"), v.literal("public")),
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_owner", ["ownerId"])
    .index("by_url", ["url"]);
