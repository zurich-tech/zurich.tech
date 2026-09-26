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
import { advance, hourly, initialCeiling, recipientsLocked } from "./policy";

/** Empty counters do not imply permission to send. */
export const quotaDefaults = {
    date: "",
    count: 0,
    nextAt: 0,
    ceiling: initialCeiling,
    accepted: 0,
    bounced: 0,
    complained: 0,
};

/** Read policy and counters as one administration view while retaining separate ownership. */
export async function state(ctx: QueryCtx) {
    const policy = await ctx.db.query("mailPolicy").unique();
    const quota = (await ctx.db.query("mailQuota").unique()) ?? quotaDefaults;
    const usage = advance(quota, Date.now());
    return {
        ...quota,
        ...usage,
        isPaused: policy?.isPaused ?? true,
        pauseReason: policy?.pauseReason,
        limits: { daily: usage.ceiling, hourly: hourly(usage.ceiling) },
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
    args: { isPaused: v.boolean() },
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

    // advance the sending day, preserving hourly pacing across midnight
    const { date, count, ceiling } = advance(quota, now);
    if (count >= ceiling || now < quota.nextAt) return false;
    await ctx.db.patch(quota._id, {
        date,
        count: count + 1,
        ceiling,
        nextAt: now + 3600000 / hourly(ceiling),
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
