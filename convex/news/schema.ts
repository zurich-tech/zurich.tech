import { defineTable } from "convex/server";
import { v } from "convex/values";

import { content } from "./content";

/** Published content remains stable while the team edits a draft. */
export const posts = defineTable({
    slug: v.string(),
    draft: content,
    published: v.optional(content),
    // retain the original story date independently of subsequent editorial changes
    date: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    updatedAt: v.number(),
    createdBy: v.id("members"),
}).index("by_slug", ["slug"]);

/** Published organisation mentions, without editorial drafts or article bodies. */
export const newsMentions = defineTable({
    postId: v.id("posts"),
    organisationId: v.id("organisations"),
    slug: v.string(),
    title: v.string(),
    date: v.number(),
    originalDate: v.number(),
    path: v.string(),
    image: v.optional(v.string()),
    isFunding: v.boolean(),
})
    .index("by_post", ["postId"])
    .index("by_organisation", ["organisationId"]);
