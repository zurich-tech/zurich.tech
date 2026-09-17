import { v } from "convex/values";

/** Link-only access is independent of publication and registration policy. */
export const visibility = v.union(v.literal("public"), v.literal("unlisted"));

/** Existing events remain public unless explicitly removed from discovery. */
export function isListed(event: { status: string; visibility?: "public" | "unlisted" }) {
    return event.status !== "draft" && event.visibility !== "unlisted";
}
