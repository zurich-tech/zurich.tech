import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { inferReviews } from "./reviews";

/** Backfill one bounded page without modifying answers, completion, or account timestamps. */
export const page = internalMutation({
    args: { cursor: v.union(v.string(), v.null()), dryRun: v.boolean() },
    handler: async (ctx, args) => {
        const result = await ctx.db
            .query("accounts")
            .paginate({ cursor: args.cursor, numItems: 100 });
        let changed = 0;
        let questions = 0;
        let completed = 0;
        for (const account of result.page) {
            if (account.surveyCompletedAt !== undefined) completed++;
            if (account.surveyReviews !== undefined) continue;
            const reviews = inferReviews(account);
            changed++;
            questions += reviews.length;
            if (!args.dryRun) await ctx.db.patch(account._id, { surveyReviews: reviews });
        }

        return {
            cursor: result.continueCursor,
            done: result.isDone,
            scanned: result.page.length,
            changed,
            questions,
            completed,
        };
    },
});

/** Scan every account; a second applied run is a no-op. */
export const run = internalAction({
    args: { dryRun: v.boolean() },
    handler: async (
        ctx,
        args,
    ): Promise<{ scanned: number; changed: number; questions: number; completed: number }> => {
        const total = { scanned: 0, changed: 0, questions: 0, completed: 0 };
        let cursor: string | null = null;
        let done = false;
        while (!done) {
            const result: {
                cursor: string;
                done: boolean;
                scanned: number;
                changed: number;
                questions: number;
                completed: number;
            } = await ctx.runMutation(internal.members.backfill.page, {
                cursor,
                dryRun: args.dryRun,
            });
            for (const key of ["scanned", "changed", "questions", "completed"] as const)
                total[key] += result[key];
            cursor = result.cursor;
            done = result.done;
        }

        return total;
    },
});
