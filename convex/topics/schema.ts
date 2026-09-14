import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Curated subjects shared by content and member interests; slugs are stable keys. */
export const topics = defineTable({
    slug: v.string(),
    name: v.string(),
    isActive: v.boolean(),
}).index("by_slug", ["slug"]);
