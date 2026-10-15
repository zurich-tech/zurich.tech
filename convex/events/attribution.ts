import { v } from "convex/values";

/** Who organises an event, independently of its registration provider. */
export const attribution = v.union(v.literal("ours"), v.literal("external"));

/** Resolve an event override before its series; unclaimed events remain external. */
export function eventAttribution(
    event: { attribution?: "ours" | "external" },
    series?: { attribution?: "ours" | "external" } | null,
) {
    return event.attribution ?? series?.attribution ?? "external";
}
