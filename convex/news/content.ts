import { v } from "convex/values";

/** Editable content, snapshotted when published. */
export const content = v.object({
    title: v.string(),
    description: v.string(),
    body: v.string(),
    kind: v.union(v.literal("post"), v.literal("link")),
    category: v.optional(v.literal("funding")),
    url: v.optional(v.string()),
    image: v.optional(v.string()),
    topics: v.array(v.string()),
    authors: v.array(v.id("members")),
    organisations: v.array(v.id("organisations")),
});
