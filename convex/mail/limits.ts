import { ConvexError } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";

/** Consume one request from a bounded verification window. */
export async function consumeLimit(
    ctx: MutationCtx,
    key: string,
    maximum: number,
    duration: number,
    now: number,
) {
    const limit = await ctx.db
        .query("limits")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
    if (!limit) {
        await ctx.db.insert("limits", { key, count: 1, expiresAt: now + duration });
    } else if (limit.expiresAt <= now) {
        await ctx.db.patch(limit._id, { count: 1, expiresAt: now + duration });
    } else if (limit.count >= maximum) {
        throw new ConvexError("Too many verification requests. Try again later.");
    } else {
        await ctx.db.patch(limit._id, { count: limit.count + 1 });
    }
}

/** Remove expired counters instead of retaining one row per email forever. */
export const expire = internalMutation({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db
            .query("limits")
            .withIndex("by_expiry", (q) => q.lte("expiresAt", Date.now()))
            .take(1000);
        for (const row of rows) await ctx.db.delete(row._id);
        return rows.length;
    },
});
