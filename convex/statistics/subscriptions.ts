import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { date, type Point } from "./history";

/** Subscription fields that determine public counts and history. */
type Subscription = Pick<Doc<"subscriptions">, "status" | "history" | "createdAt">;

/** One day's contribution from a subscription history. */
type Day = { change: number; observations: number; estimates: number };

/** Group one subscription's dated changes without including suppressed addresses. */
export function subscriptionChanges(subscription: Subscription | null) {
    const result = new Map<string, Day>();
    if (!subscription || subscription.status === "suppressed") return result;
    const history = subscription.history ?? [
        { at: subscription.createdAt, status: subscription.status, isEstimated: true },
    ];
    let active = false;

    // preserve zero-net observation days and the latest estimated observation
    for (const entry of history) {
        const key = date(entry.at);
        const day = result.get(key) ?? { change: 0, observations: 0, estimates: 0 };
        const next = entry.status === "subscribed";
        day.change += Number(next) - Number(active);
        day.observations++;
        day.estimates += Number(!!entry.isEstimated);
        result.set(key, day);
        active = next;
    }

    return result;
}

/** Apply only changed dates and totals in the subscription's transaction. */
export async function update(
    ctx: MutationCtx,
    before: Subscription | null,
    after: Subscription | null,
) {
    const previous = subscriptionChanges(before);
    const current = subscriptionChanges(after);
    for (const key of new Set([...previous.keys(), ...current.keys()])) {
        const old = previous.get(key) ?? { change: 0, observations: 0, estimates: 0 };
        const next = current.get(key) ?? { change: 0, observations: 0, estimates: 0 };
        if (
            old.change === next.change &&
            old.observations === next.observations &&
            old.estimates === next.estimates
        )
            continue;
        const row = await ctx.db
            .query("subscriptionDays")
            .withIndex("by_date", (query) => query.eq("date", key))
            .unique();
        const values = {
            date: key,
            change: (row?.change ?? 0) + next.change - old.change,
            observations: (row?.observations ?? 0) + next.observations - old.observations,
            estimates: (row?.estimates ?? 0) + next.estimates - old.estimates,
        };
        if (values.observations < 0 || values.estimates < 0)
            throw new Error("subscription statistics require a backfill");
        if (!values.observations) {
            if (values.change || values.estimates)
                throw new Error("subscription history counts disagree");
            if (row) await ctx.db.delete(row._id);
        } else if (row) await ctx.db.patch(row._id, values);
        else await ctx.db.insert("subscriptionDays", values);
    }

    // preference-only edits leave public statistics untouched
    const change = Number(after?.status === "subscribed") - Number(before?.status === "subscribed");
    if (!change) return;
    const totals = await ctx.db.query("communityTotals").unique();
    const subscribers = (totals?.subscribers ?? 0) + change;
    if (subscribers < 0) throw new Error("subscriber total requires a backfill");
    if (totals) await ctx.db.patch(totals._id, { subscribers });
    else await ctx.db.insert("communityTotals", { subscribers });
}

/** Read dated aggregates without loading subscription identities or preferences. */
export async function history(ctx: QueryCtx, now: number): Promise<Point[]> {
    const rows = await ctx.db
        .query("subscriptionDays")
        .withIndex("by_date", (query) => query.lte("date", date(now)))
        .collect();
    const cutoff = rows.findLast((row) => row.estimates > 0)?.date;
    let value = 0;

    return rows.map((row) => ({
        date: row.date,
        value: (value += row.change),
        isEstimated: cutoff !== undefined && row.date < cutoff,
    }));
}
