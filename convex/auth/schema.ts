import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Whether the authenticated identity may access the site. */
const accountStatus = v.union(v.literal("active"), v.literal("disabled"));

/** Stored accounts. */
export const accounts = defineTable({
    authId: v.string(),
    isTeam: v.boolean(),
    memberId: v.id("members"),
    status: accountStatus,
    createdAt: v.number(),
    updatedAt: v.number(),
})
    .index("by_member", ["memberId"])
    .index("by_auth", ["authId"]);
