import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { state } from "./sending";
import { requireAudienceDelivery } from "./policy";

/** Release an operator-verified subset of an existing queue without rebuilding its messages. */
export const release = internalMutation({
    args: {
        campaignId: v.id("campaigns"),
        messageIds: v.array(v.id("messages")),
        source: v.string(),
        isDryRun: v.boolean(),
    },
    handler: async (ctx, args) => {
        // keep reviewed batches within the existing daily approval and pacing
        requireAudienceDelivery();
        const settings = await state(ctx);
        const count = args.messageIds.length;
        if (settings.isPaused || count < 1 || count > 100 || settings.remaining < count)
            throw new Error("Approve enough active allowance for 1 to 100 reviewed messages.");
        if (new Set(args.messageIds).size !== count || !args.source.trim())
            throw new Error("Provide distinct reviewed messages and their verification source.");
        const campaign = await ctx.db.get(args.campaignId);
        if (
            !campaign ||
            campaign.category !== "campaign" ||
            campaign.cursor !== campaign.recipients?.length ||
            !["paused", "queued"].includes(campaign.status) ||
            (!campaign.reviewedBatch && campaign.status !== "paused")
        )
            throw new Error(
                "Pause a fully materialised campaign before its first reviewed release.",
            );
        if (campaign.expiresAt !== undefined && campaign.expiresAt <= Date.now())
            throw new Error("This campaign has expired.");

        // retain at most one unresolved provider outcome across all reviewed batches
        const pending = [];
        for (const id of [
            ...(campaign.reviewedBatch?.pending ?? []),
            ...(campaign.reviewedBatch?.messages ?? []),
        ]) {
            const message = await ctx.db.get(id);
            if (!message || message.campaignId !== campaign._id || message.status === "queued")
                throw new Error("The previous reviewed batch has not settled.");
            if (message.status === "accepted" && !message.outcome) pending.push(id);
        }
        if (pending.length > 1)
            throw new Error("More than one reviewed delivery is awaiting a provider outcome.");

        // keep only one bulk campaign active
        const campaigns = await ctx.db.query("campaigns").collect();
        if (
            campaigns.some(
                (row) =>
                    row._id !== campaign._id &&
                    ["queued", "scheduled"].includes(row.status) &&
                    ["campaign", "announcement", "weekly"].includes(row.category ?? ""),
            )
        )
            throw new Error("Pause other bulk campaigns before releasing a batch.");

        // reject stale evidence, opt-outs, aliases and any previously contacted recipient
        const identities = new Set<string>();
        for (const id of args.messageIds) {
            const message = await ctx.db.get(id);
            const subscription = message?.subscriptionId
                ? await ctx.db.get(message.subscriptionId)
                : null;
            if (
                !message ||
                message.campaignId !== campaign._id ||
                message.isTest ||
                !message.isBulk ||
                message.status !== "queued" ||
                message.attempts !== 0 ||
                message.firstAttemptAt !== undefined ||
                message.claimedAt !== undefined ||
                !subscription ||
                subscription.email !== message.to ||
                subscription.status !== "subscribed" ||
                !subscription.token ||
                subscription.hasDeliveryFailure ||
                subscription.deliveredAt !== undefined ||
                (subscription.weekly === false && subscription.announcements === false)
            )
                throw new Error(
                    "Reviewed recipients must be untouched, subscribed and without adverse history.",
                );
            const keys = [
                message.to.trim().toLowerCase(),
                ...(subscription.memberId ? [subscription.memberId] : []),
            ];
            if (keys.some((key) => identities.has(key)))
                throw new Error("Duplicate reviewed recipient identity.");
            keys.forEach((key) => identities.add(key));
            const aliases = subscription.memberId
                ? await ctx.db
                      .query("subscriptions")
                      .withIndex("by_member", (q) => q.eq("memberId", subscription.memberId))
                      .collect()
                : [subscription];
            for (const alias of aliases) {
                const history = await ctx.db
                    .query("messages")
                    .withIndex("by_recipient", (q) => q.eq("to", alias.email))
                    .collect();
                if (
                    history.some(
                        (row) =>
                            !row.isTest && (row.attempts > 0 || row.firstAttemptAt !== undefined),
                    )
                )
                    throw new Error("Reviewed recipient has already been contacted.");
            }
        }
        if (args.isDryRun) return { count, released: false };

        // install the exact batch atomically before enabling its existing queued messages
        const now = Date.now();
        for (const [index, id] of args.messageIds.entries())
            await ctx.db.patch(id, { nextAttemptAt: now - count + index });
        await ctx.db.patch(campaign._id, {
            reviewedBatch: { messages: args.messageIds, source: args.source, pending },
            attemptLimit: (campaign.attempts ?? 0) + count,
            status: "queued",
            updatedAt: now,
        });

        return { count, released: true };
    },
});

/** Apply a reviewed due order in bounded batches while bulk sending is stopped. */
export const apply = internalMutation({
    args: {
        campaignId: v.id("campaigns"),
        messageIds: v.array(v.id("messages")),
        first: v.number(),
    },
    handler: async (ctx, args) => {
        // preserve authorization and require a fully materialised campaign
        const settings = await state(ctx);
        if (!settings.isPaused && settings.remaining > 0)
            throw new Error("Stop bulk sending before reordering a campaign.");
        const campaign = await ctx.db.get(args.campaignId);
        if (
            !campaign ||
            !["queued", "paused"].includes(campaign.status) ||
            campaign.cursor !== campaign.recipients?.length
        )
            throw new Error("Campaign must be fully queued before reordering.");
        if (
            args.messageIds.length > 100 ||
            new Set(args.messageIds).size !== args.messageIds.length ||
            !Number.isSafeInteger(args.first) ||
            args.first + args.messageIds.length > Date.now()
        )
            throw new Error("Provide at most 100 distinct messages with past due positions.");

        // reject changed, attempted or unrelated messages atomically, without touching retry backoff
        for (const [index, id] of args.messageIds.entries()) {
            const message = await ctx.db.get(id);
            if (
                !message ||
                message.campaignId !== args.campaignId ||
                message.status !== "queued" ||
                message.isTest ||
                message.attempts !== 0 ||
                message.claimedAt
            )
                throw new Error("Only unattempted queued campaign messages can be reordered.");
            await ctx.db.patch(id, { nextAttemptAt: args.first + index });
        }

        return args.messageIds.length;
    },
});
