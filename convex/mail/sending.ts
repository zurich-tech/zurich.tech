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
import { advance, hourly, initialCeiling, maximumCeiling, recipientsLocked } from "./policy";

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
    // project today's usage without modifying persisted counters
    const policy = await ctx.db.query("mailPolicy").unique();
    const quota = (await ctx.db.query("mailQuota").unique()) ?? quotaDefaults;
    const usage = advance(quota, Date.now());
    const approvedLimit = policy?.approvedDate === usage.date ? (policy.approvedLimit ?? 0) : 0;
    const remaining = Math.max(0, Math.min(approvedLimit, usage.ceiling) - usage.count);

    return {
        ...quota,
        ...usage,
        isPaused: policy?.isPaused ?? true,
        pauseReason: policy?.pauseReason,
        limits: { daily: usage.ceiling, hourly: hourly(usage.ceiling) },
        approvedLimit,
        remaining,
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

/** Approve today's total attempts and pace without enabling delivery or resetting counters. */
export const approve = mutation({
    args: { limit: v.number(), ceiling: v.number() },
    handler: async (ctx, args) => {
        // restrict approvals to valid, bounded administrator requests
        await requireAdmin(ctx);
        if (
            !Number.isInteger(args.limit) ||
            !Number.isInteger(args.ceiling) ||
            args.limit < 0 ||
            args.ceiling < 1 ||
            args.limit > args.ceiling ||
            args.ceiling > maximumCeiling
        )
            throw new Error(
                "Choose whole-number limits between 0 and the daily pace, up to 10,000.",
            );

        // preserve consumed attempts, health counters and the next reserved send time
        const quota = await ctx.db.query("mailQuota").unique();
        const usage = advance(quota ?? quotaDefaults, Date.now());
        if (args.limit < usage.count)
            throw new Error("The approved total cannot be lower than today's used attempts.");

        // save the reviewed pace without replenishing usage
        const values = { ...usage, ceiling: args.ceiling };
        if (quota) await ctx.db.patch(quota._id, values);
        else await ctx.db.insert("mailQuota", { ...quotaDefaults, ...values });

        // a missing policy remains paused; approval alone never releases queued messages
        const policy = await ctx.db.query("mailPolicy").unique();
        const approval = { approvedDate: usage.date, approvedLimit: args.limit };
        if (policy) await ctx.db.patch(policy._id, approval);
        else await ctx.db.insert("mailPolicy", { isPaused: true, ...approval });
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
    if (
        policy.approvedDate !== date ||
        count >= (policy.approvedLimit ?? 0) ||
        count >= ceiling ||
        now < quota.nextAt
    )
        return false;
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
            if (
                bulk &&
                (settings.isPaused ||
                    settings.isLocked ||
                    !settings.hasWebhook ||
                    settings.remaining === 0)
            )
                continue;
            const rows = bulk
                ? await dueBulk(ctx, now)
                : await ctx.db
                      .query("messages")
                      .withIndex("by_due", (q) =>
                          q.eq("isBulk", bulk).eq("status", "queued").lte("nextAttemptAt", now),
                      )
                      .take(100);
            let position = 0;
            for (const row of rows) {
                // rotate held work so it cannot starve another campaign
                const campaign = row.campaignId ? await ctx.db.get(row.campaignId) : null;
                if (
                    (!row.isTest &&
                        (campaign?.status === "paused" ||
                            (campaign?.attemptLimit !== undefined &&
                                (campaign.attempts ?? 0) >= campaign.attemptLimit))) ||
                    !recipientAllowed(row.to)
                ) {
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

/** Read due bulk mail only from campaigns allowed to run, plus standalone messages. */
async function dueBulk(ctx: QueryCtx, now: number) {
    // select campaign state before reading message bodies, so paused backlogs cost no queue slots
    const campaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_schedule", (q) => q.eq("status", "queued"))
        .collect();
    const active = campaigns.filter(
        (campaign) =>
            campaign.attemptLimit === undefined || (campaign.attempts ?? 0) < campaign.attemptLimit,
    );
    const rows = [];
    for (const id of [undefined, ...active.map((campaign) => campaign._id)]) {
        // read only the reviewed identities so an older backlog cannot consume queue slots
        const reviewed = active.find((campaign) => campaign._id === id)?.reviewedBatch;
        if (reviewed) {
            for (const messageId of reviewed.messages) {
                const message = await ctx.db.get(messageId);
                if (!message || message.campaignId !== id)
                    throw new Error("Reviewed campaign message no longer exists.");
                if (message.status === "queued" && message.nextAttemptAt <= now) rows.push(message);
            }
            continue;
        }
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_campaign_due", (q) =>
                q
                    .eq("campaignId", id)
                    .eq("isBulk", true)
                    .eq("status", "queued")
                    .lte("nextAttemptAt", now),
            )
            .take(100);
        rows.push(...messages);
    }

    // retain global due-time order and the existing per-dispatch bound
    return rows
        .sort(
            (left, right) =>
                left.nextAttemptAt - right.nextAttemptAt ||
                left._creationTime - right._creationTime,
        )
        .slice(0, 100);
}
