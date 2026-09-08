import type { MutationCtx } from "./_generated/server";

/** Consume one anonymous submission allowance. */
export async function consumeSubmissionLimit(
    ctx: MutationCtx,
    key: string,
    maximum: number,
    duration: number,
    now: number,
) {
    const limit = await ctx.db
        .query("submissionLimits")
        .withIndex("by_key", (query) => query.eq("key", key))
        .unique();

    // begin the first window
    if (limit === null) {
        await ctx.db.insert("submissionLimits", {
            count: 1,
            key,
            startedAt: now,
            updatedAt: now,
        });
    }
    // begin a new elapsed window
    else if (now - limit.startedAt >= duration) {
        await ctx.db.patch(limit._id, { count: 1, startedAt: now, updatedAt: now });
    }
    // reject exhausted windows
    else if (limit.count >= maximum) {
        throw new Error("Too many submissions. Try again later.");
    }
    // consume the next allowance
    else {
        await ctx.db.patch(limit._id, { count: limit.count + 1, updatedAt: now });
    }
}
