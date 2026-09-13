import { internal } from "../_generated/api";
import { recipientAllowed } from "./policy";
import { updateMessage } from "./progress";
import { v } from "convex/values";
import {
    query,
    mutation,
    internalMutation,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import { requireAdmin } from "../auth/access";
import { ceilings, recipientsLocked, sendingDate } from "./policy";

/** Empty counters do not imply permission to send. */
export const quotaDefaults = {
    day: 0,
    date: "",
    count: 0,
    nextAt: 0,
    accepted: 0,
    bounced: 0,
    complained: 0,
};

/** Project today's usage without advancing stored counters until an email is sent. */
function dailyUsage(quota: { day: number; date: string; count: number }, now: number) {
    const date = sendingDate(now);
    const isNewDay = quota.date !== date;
    return {
        date,
        day: quota.day + (isNewDay && quota.count > 0 ? 1 : 0),
        count: isNewDay ? 0 : quota.count,
    };
}

/** Read policy and counters as one administration view while retaining separate ownership. */
export async function state(ctx: QueryCtx) {
    const policy = await ctx.db.query("mailPolicy").unique();
    const quota = (await ctx.db.query("mailQuota").unique()) ?? quotaDefaults;
    const profile = policy?.profile ?? "new";
    const usage = dailyUsage(quota, Date.now());
    return {
        ...quota,
        ...usage,
        profile,
        isPaused: policy?.isPaused ?? true,
        pauseReason: policy?.pauseReason,
        limits: ceilings(profile, usage.day),
        isLocked: recipientsLocked(),
        sender: process.env.MAIL_FROM ?? "Not configured",
        hasWebhook: !!process.env.RESEND_WEBHOOK_SECRET,
    };
}

/** Show current sender readiness without exposing credentials. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        return await state(ctx);
    },
});

/** Change policy explicitly; the test allowlist is never editable through this operation. */
export const configure = mutation({
    args: {
        isPaused: v.boolean(),
        profile: v.union(v.literal("new"), v.literal("established"), v.literal("complete")),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        if (!args.isPaused && recipientsLocked())
            throw new Error("Test recipient lock is enabled.");
        if (
            !args.isPaused &&
            (!process.env.RESEND_WEBHOOK_SECRET ||
                !process.env.MAIL_FROM ||
                !process.env.RESEND_API_KEY)
        )
            throw new Error("Configure the sender and signed delivery webhooks first.");
        const policy = await ctx.db.query("mailPolicy").unique();
        if (policy && !policy.isPaused && args.profile !== policy.profile)
            throw new Error("Pause bulk delivery before changing limits.");

        // preserve pacing across changes; an explicit resume starts a new health review period
        const quota = await ctx.db.query("mailQuota").unique();
        if (!quota) await ctx.db.insert("mailQuota", quotaDefaults);
        else if (policy?.isPaused && !args.isPaused)
            await ctx.db.patch(quota._id, { accepted: 0, bounced: 0, complained: 0 });
        const values = {
            ...args,
            pauseReason: args.isPaused ? policy?.pauseReason : undefined,
        };
        if (policy) await ctx.db.patch(policy._id, values);
        else await ctx.db.insert("mailPolicy", values);
    },
});

/** Reserve one paced bulk attempt atomically, including retries. */
export async function reserve(ctx: MutationCtx, now: number) {
    const policy = await ctx.db.query("mailPolicy").unique();
    if (!policy || policy.isPaused || recipientsLocked() || !process.env.RESEND_WEBHOOK_SECRET)
        return false;
    const quota = await ctx.db.query("mailQuota").unique();
    if (!quota) throw new Error("Sending quota is not configured.");

    // advance only after an active sending day, preserving hourly pacing across midnight
    const { date, day, count } = dailyUsage(quota, now);
    const limit = ceilings(policy.profile, day);
    if (count >= limit.daily || now < quota.nextAt) return false;
    await ctx.db.patch(quota._id, {
        day,
        date,
        count: count + 1,
        nextAt: now + 3600000 / limit.hourly,
    });
    return true;
}

/** Recover due work and schedule bounded attempts, including interrupted transactional mail. */
export const dispatch = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const settings = await state(ctx);
        for (const bulk of [false, true]) {
            if (bulk && (settings.isPaused || settings.isLocked || !settings.hasWebhook)) continue;
            const rows = await ctx.db
                .query("messages")
                .withIndex("by_due", (q) =>
                    q.eq("isBulk", bulk).eq("status", "queued").lte("nextAttemptAt", now),
                )
                .take(100);
            let position = 0;
            for (const row of rows) {
                // rotate held work so it cannot starve another campaign
                const campaign = row.campaignId ? await ctx.db.get(row.campaignId) : null;
                if ((campaign?.status === "paused" && !row.isTest) || !recipientAllowed(row.to)) {
                    await ctx.db.patch(row._id, { nextAttemptAt: now + 60000 });
                    continue;
                }
                if (row.attempts >= 5) {
                    await updateMessage(ctx, row, {
                        status: "failed",
                        error: "Delivery interrupted. Check the provider before retrying.",
                    });
                    continue;
                }
                const at = now + position++ * (bulk ? 3600000 / settings.limits.hourly : 600);
                if (at >= now + 60000) break;
                await ctx.scheduler.runAt(at, internal.mail.messages.deliver, {
                    id: row._id,
                });
                await ctx.db.patch(row._id, { nextAttemptAt: at });
            }
        }
    },
});
