import { tiers } from "../../src/sponsorships/plans";
import { v } from "convex/values";

/** The entitlement being purchased. */
export const purchase = v.union(
    v.object({ kind: v.literal("patron") }),
    v.object({ kind: v.literal("job"), id: v.id("jobs") }),
    v.object({ kind: v.literal("sponsorship"), id: v.id("sponsorships") }),
);

/** Sponsorship levels defined by the shared product catalogue. */
export const tier = v.union(...tiers.map((plan) => v.literal(plan.id)));

/** A reserved purchase always names its record. */
export const purchaseRecord = v.union(
    v.object({ kind: v.literal("job"), id: v.id("jobs") }),
    v.object({ kind: v.literal("sponsorship"), id: v.id("sponsorships") }),
);
