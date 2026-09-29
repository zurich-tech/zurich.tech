import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { state } from "./sending";

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
