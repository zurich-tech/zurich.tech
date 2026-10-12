import type { MutationCtx, QueryCtx } from "../_generated/server";
import { sendingDate } from "./policy";

/** Maximum complaint percentage before bulk delivery is paused. */
export const complaintLimit = 0.08;

/** Read seven Zurich calendar days of provider-accepted bulk messages and their complaints. */
export async function health(ctx: QueryCtx, now: number) {
    const today = sendingDate(now);
    const first = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86400000)
        .toISOString()
        .slice(0, 10);
    const days = await ctx.db
        .query("mailHealth")
        .withIndex("by_date", (q) => q.gte("date", first).lte("date", today))
        .collect();
    const sent = days.reduce((total, day) => total + day.sent, 0);
    const complained = days.reduce((total, day) => total + day.complained, 0);

    return { sent, complained, rate: sent === 0 ? 0 : (complained * 100) / sent };
}

/** Count a provider acceptance once, separately from attempted sends and retries. */
export async function recordSent(ctx: MutationCtx, now: number) {
    const date = sendingDate(now);
    const day = await ctx.db
        .query("mailHealth")
        .withIndex("by_date", (q) => q.eq("date", date))
        .unique();
    if (day) await ctx.db.patch(day._id, { sent: day.sent + 1 });
    else await ctx.db.insert("mailHealth", { date, sent: 1, complained: 0 });
}

/** Attribute a complaint to its original send date, not the webhook arrival date. */
export async function recordComplaint(ctx: MutationCtx, sentAt: number) {
    const date = sendingDate(sentAt);
    const day = await ctx.db
        .query("mailHealth")
        .withIndex("by_date", (q) => q.eq("date", date))
        .unique();
    if (!day) throw new Error("Complaint has no recorded sending cohort.");
    await ctx.db.patch(day._id, { complained: day.complained + 1 });
}
