import type { Doc } from "../_generated/dataModel";

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
