import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

/** One dated subscription state and the evidence establishing it. */
export type SubscriptionChange = NonNullable<Doc<"subscriptions">["history"]>[number];

/** Retain subscription changes without counting repeated saves as new subscriptions. */
export function subscriptionHistory(
    previous: Doc<"subscriptions"> | null,
    next: Pick<Doc<"subscriptions">, "status" | "weekly">,
    at: number,
    source: string,
): SubscriptionChange[] {
    // preserve earlier states before applying a preference change
    const history =
        previous?.history ??
        (previous
            ? [
                  {
                      at: previous.createdAt,
                      status: previous.status,
                      weekly: previous.weekly !== false,
                      source: previous.source ?? "account",
                      isEstimated: true,
                  },
              ]
            : []);
    const last = history.at(-1);
    if (last?.status === next.status && last.weekly === (next.weekly !== false)) return history;

    return [...history, { at, status: next.status, weekly: next.weekly !== false, source }];
}

/** Record delivery evidence without changing consent or suppression. */
export async function record(ctx: MutationCtx, message: Doc<"messages">) {
    if (message.isTest) return;
    const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_email", (q) => q.eq("email", message.to))
        .unique();
    if (!subscription) return;

    // preserve adverse history even if another message succeeds later
    const hasFailure =
        message.status === "failed" ||
        ["bounced", "complained", "failed", "suppressed"].includes(message.outcome ?? "");
    const deliveredAt = message.outcome === "delivered" ? message.firstAttemptAt : undefined;
    if (hasFailure || deliveredAt !== undefined)
        await ctx.db.patch(subscription._id, {
            hasDeliveryFailure: subscription.hasDeliveryFailure || hasFailure,
            deliveredAt:
                deliveredAt === undefined
                    ? subscription.deliveredAt
                    : Math.max(subscription.deliveredAt ?? 0, deliveredAt),
        });
}

/** Index existing outcomes in bounded pages before enabling delivery-based audiences. */
export const backfill = internalMutation({
    args: { cursor: v.union(v.string(), v.null()) },
    handler: async (ctx, args) => {
        const policy = await ctx.db.query("mailPolicy").unique();
        if (!policy) throw new Error("Sending policy is missing.");
        const page = await ctx.db
            .query("messages")
            .paginate({ cursor: args.cursor, numItems: 100 });
        for (const message of page.page) await record(ctx, message);
        if (page.isDone) await ctx.db.patch(policy._id, { isHistoryReady: true });
        else
            await ctx.scheduler.runAfter(0, internal.mail.history.backfill, {
                cursor: page.continueCursor,
            });
    },
});
