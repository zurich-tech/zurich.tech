import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { normalizeEmail } from "../members/emails";
import { subscriptionHistory } from "./history";

/** Enable every email category for a new subscription. */
export const emailPreferences = {
    weekly: true,
    announcements: true,
    reminders: true,
    followUps: true,
};

/** Enrol a verified address without overwriting any existing email choices. */
export async function enrollSubscription(
    ctx: MutationCtx,
    values: { email: string; token: string; memberId?: Id<"members">; source: string },
    now: number,
) {
    const email = normalizeEmail(values.email);
    const existing = await ctx.db
        .query("subscriptions")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
    if (existing) return;

    // retain the entry point alongside the initial subscription state
    const state = { status: "subscribed" as const, ...emailPreferences };
    await ctx.db.insert("subscriptions", {
        ...values,
        email,
        ...state,
        history: subscriptionHistory(null, state, now, values.source),
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
    });
}
