import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

import { tiers, personalTiers } from "../sponsorships/plans";
import { ConvexError, v } from "convex/values";

/** Personal support levels defined by the shared product catalogue. */
export const personalTier = v.union(...personalTiers.map((plan) => v.literal(plan.id)));

/** The entitlement being purchased. */
export const purchase = v.union(
    v.object({ kind: v.literal("support"), tier: personalTier }),
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

/** Require any hosted payment for a sponsorship to finish or expire before manual changes. */
export async function requireCheckoutClosed(ctx: MutationCtx, id: Id<"sponsorships">) {
    // find unexpired hosted sessions for this sponsorship
    const pending = await ctx.db
        .query("checkouts")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect();
    if (
        pending.some(
            (row) =>
                row.expiresAt > Date.now() &&
                row.purchase.kind === "sponsorship" &&
                row.purchase.id === id,
        )
    )
        throw new ConvexError(
            "A payment is open for this sponsorship. Complete it or wait for the checkout to expire before changing it.",
        );
}
