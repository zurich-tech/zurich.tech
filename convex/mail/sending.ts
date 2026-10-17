import { internal } from "../_generated/api";
import {
    recipientAllowed,
    advance,
    approvedCampaign,
    hourly,
    initialCeiling,
    maximumCeiling,
    recipientsLocked,
    scheduledNewsletter,
} from "./policy";
import { updateMessage } from "./progress";
import { ConvexError, v } from "convex/values";
import {
    query,
    mutation,
    internalMutation,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import { requireAdmin } from "../auth/access";
import type { Doc } from "../_generated/dataModel";
import { health } from "./health";

/** Empty counters do not imply permission to send. */
export const quotaDefaults: Omit<Doc<"mailQuota">, "_id" | "_creationTime"> = {
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
        limits: { daily: usage.ceiling, hourly: hourly(usage.ceiling, quota.hourlyLimit) },
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
        return { ...(await state(ctx)), health: await health(ctx, Date.now()) };
    },
});

/** Set shared delivery limits without approving campaigns or resetting usage and health. */
export const pace = mutation({
    args: { daily: v.number(), hourly: v.number() },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        if (
            !Number.isInteger(args.daily) ||
            !Number.isInteger(args.hourly) ||
            args.daily < 1 ||
            args.daily > maximumCeiling ||
            args.hourly < 1 ||
            args.hourly > 3600
        )
            throw new ConvexError(
                "Choose a daily limit from 1 to 10,000 and an hourly limit from 1 to 3,600.",
            );

        // preserve consumed attempts, pending reservations and delivery health
        const quota = await ctx.db.query("mailQuota").unique();
        const values = { ceiling: args.daily, hourlyLimit: args.hourly };
        if (quota) await ctx.db.patch(quota._id, values);
        else await ctx.db.insert("mailQuota", { ...quotaDefaults, ...values });
    },
});

/** Approve today's total attempts without changing limits, enabling delivery or resetting counters. */
export const approve = mutation({
    args: { limit: v.number() },
    handler: async (ctx, args) => {
        // restrict approvals to valid, bounded administrator requests
        await requireAdmin(ctx);
        const quota = await ctx.db.query("mailQuota").unique();
        const usage = advance(quota ?? quotaDefaults, Date.now());
        if (!Number.isInteger(args.limit) || args.limit < 0 || args.limit > usage.ceiling)
            throw new ConvexError(
                "Choose whole-number limits between 0 and the daily pace, up to 10,000.",
            );

        // preserve consumed attempts, health counters and the next reserved send time
        if (args.limit < usage.count)
            throw new ConvexError("The approved total cannot be lower than today's used attempts.");

        // initialise missing counters without modifying an existing quota
        if (!quota) await ctx.db.insert("mailQuota", { ...quotaDefaults, ...usage });

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
            throw new ConvexError("Test recipient lock is enabled.");
        if (
            !args.isPaused &&
            (!process.env.RESEND_WEBHOOK_SECRET ||
                !process.env.MAIL_FROM ||
                !process.env.RESEND_API_KEY)
        )
            throw new ConvexError("Configure the sender and signed delivery webhooks first.");
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
export async function reserve(ctx: MutationCtx, now: number, campaign?: Doc<"campaigns"> | null) {
    const policy = await ctx.db.query("mailPolicy").unique();
    if (!policy || policy.isPaused || recipientsLocked() || !process.env.RESEND_WEBHOOK_SECRET)
        return false;
    const quota = await ctx.db.query("mailQuota").unique();
    if (!quota) throw new Error("Sending quota is not configured.");

    // advance the sending day, preserving hourly pacing across midnight
    const { date, count, ceiling } = advance(quota, now);
    const schedule = await ctx.db.query("mailSchedules").unique();
    const isAutomatic = scheduledNewsletter(campaign, schedule?.lastWeek, now);
    const isApproved = campaign?.approval
        ? approvedCampaign(campaign, now)
        : isAutomatic || (policy.approvedDate === date && count < (policy.approvedLimit ?? 0));
    if (
        !isApproved ||
        count >= ceiling ||
        now < quota.nextAt ||
        (campaign?.approval && now < (campaign.nextAttemptAt ?? 0))
    )
        return false;
    await ctx.db.patch(quota._id, {
        date,
        count: count + 1,
        ceiling,
        nextAt: now + 3600000 / hourly(ceiling, quota.hourlyLimit),
    });

    // reserve this campaign's pace in the same transaction as the shared quota
    if (campaign?.approval)
        await ctx.db.patch(campaign._id, {
            nextAttemptAt: now + 3600000 / campaign.approval.hourlyLimit,
        });

    return true;
}

/** Recover due work and schedule bounded attempts, including interrupted transactional mail. */
export const dispatch = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const settings = await state(ctx);
        const campaigns = new Map<string, Doc<"campaigns"> | null>();
        for (const bulk of [false, true]) {
            if (
                bulk &&
                (settings.isPaused ||
                    settings.isLocked ||
                    !settings.hasWebhook ||
                    settings.count >= settings.limits.daily)
            )
                continue;
            const rows = bulk
                ? await dueBulk(ctx, now, settings.remaining > 0, campaigns)
                : await ctx.db
                      .query("messages")
                      .withIndex("by_due", (q) =>
                          q.eq("isBulk", bulk).eq("status", "queued").lte("nextAttemptAt", now),
                      )
                      .take(100);
            const pending = [];
            for (const row of rows) {
                // reuse campaign state across messages and the bulk audience scan
                if (row.campaignId && !campaigns.has(row.campaignId))
                    campaigns.set(row.campaignId, await ctx.db.get(row.campaignId));
                const campaign = row.campaignId ? campaigns.get(row.campaignId) : null;

                // rotate held work so it cannot starve another campaign
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
                pending.push({ row, campaign });
            }

            // fill each shared slot from the bounded queue, retaining due order for ties
            let sharedAt = bulk ? Math.max(now, settings.nextAt) : now;
            const nextAttempts = new Map<string, number>();
            while (pending.length) {
                let selected = -1;
                let at = now + 60000;
                for (const [index, { campaign }] of pending.entries()) {
                    const campaignAt =
                        bulk && campaign?.approval
                            ? (nextAttempts.get(campaign._id) ?? campaign.nextAttemptAt ?? now)
                            : now;
                    const eligibleAt = Math.max(sharedAt, campaignAt);
                    if (eligibleAt < at) {
                        selected = index;
                        at = eligibleAt;
                    }
                }
                if (selected === -1) break;

                // advance both clocks from the allocated time, not the queue position
                const { row, campaign } = pending.splice(selected, 1)[0];
                sharedAt = at + (bulk ? 3600000 / settings.limits.hourly : 600);
                if (bulk && campaign?.approval)
                    nextAttempts.set(campaign._id, at + 3600000 / campaign.approval.hourlyLimit);
                await ctx.scheduler.runAt(at, internal.mail.messages.deliver, {
                    id: row._id,
                });
                await ctx.db.patch(row._id, { nextAttemptAt: at });
            }
        }
    },
});

/** Read due bulk mail only from campaigns allowed to run, plus standalone messages. */
async function dueBulk(
    ctx: QueryCtx,
    now: number,
    isApproved: boolean,
    cache: Map<string, Doc<"campaigns"> | null>,
) {
    // select campaign state before reading message bodies, so paused backlogs cost no queue slots
    const campaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_schedule", (q) => q.eq("status", "queued"))
        .collect();
    for (const campaign of campaigns) cache.set(campaign._id, campaign);
    const schedule = await ctx.db.query("mailSchedules").unique();
    const active = campaigns.filter(
        (campaign) =>
            (campaign.approval
                ? approvedCampaign(campaign, now)
                : isApproved || scheduledNewsletter(campaign, schedule?.lastWeek, now)) &&
            (campaign.attemptLimit === undefined ||
                (campaign.attempts ?? 0) < campaign.attemptLimit),
    );
    const rows = [];
    for (const id of [
        ...(isApproved ? [undefined] : []),
        ...active.map((campaign) => campaign._id),
    ]) {
        // read only the reviewed identities so an older backlog cannot consume queue slots
        const campaign = id ? cache.get(id) : undefined;
        const reviewed = campaign?.reviewedBatch;
        if (reviewed) {
            for (const messageId of reviewed.messages) {
                const message = await ctx.db.get(messageId);
                if (!message || message.campaignId !== id)
                    throw new Error("Reviewed campaign message no longer exists.");
                if (message.status === "queued" && message.nextAttemptAt <= now) rows.push(message);
            }
            continue;
        }
        // do not let a slow campaign fill every shared dispatch slot with waiting messages
        const capacity = campaign?.approval
            ? Math.min(
                  100,
                  Math.max(
                      0,
                      Math.ceil(
                          ((now + 60000 - Math.max(now, campaign.nextAttemptAt ?? 0)) *
                              campaign.approval.hourlyLimit) /
                              3600000,
                      ),
                  ),
              )
            : 100;
        if (!capacity) continue;
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_campaign_due", (q) =>
                q
                    .eq("campaignId", id)
                    .eq("isBulk", true)
                    .eq("status", "queued")
                    .lte("nextAttemptAt", now),
            )
            .take(capacity);
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
