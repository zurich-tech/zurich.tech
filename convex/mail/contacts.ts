import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import * as statistics from "../statistics/subscriptions";

/** Editable subscription fields. */
type Subscription = Omit<Doc<"subscriptions">, "_id" | "_creationTime">;

/** Insert a subscription and its public aggregate in one transaction. */
export async function insertSubscription(ctx: MutationCtx, values: Subscription) {
    const id = await ctx.db.insert("subscriptions", values);
    await statistics.update(ctx, null, values);

    return id;
}

/** Update preferences and dated public counts together. */
export async function updateSubscription(
    ctx: MutationCtx,
    id: Id<"subscriptions">,
    values: Partial<Subscription>,
) {
    const previous = await ctx.db.get(id);
    if (!previous) throw new Error("subscription is missing");
    await ctx.db.patch(id, values);
    await statistics.update(ctx, previous, { ...previous, ...values });
}
