import { v } from "convex/values";

/** Agreed contribution, independent of money received. */
export const contribution = v.union(
    v.object({ kind: v.literal("money"), amount: v.number() }),
    v.object({ kind: v.literal("inKind"), description: v.string() }),
);
