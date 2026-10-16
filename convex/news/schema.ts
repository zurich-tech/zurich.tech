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
