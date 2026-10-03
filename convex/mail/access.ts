import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { allows } from "../auth/permissions";

/** Recheck the sender's current access before scheduled or queued written mail proceeds. */
export async function canSend(ctx: QueryCtx, campaign: Doc<"campaigns">) {
    // automatic product campaigns follow the authority of their initiating product operation
    if (!campaign.authorId) return true;
    const account = await ctx.db.get(campaign.authorId);
    if (!account || account.status !== "active") return false;
    if (campaign.audience?.kind === "subscribers") return !!account.isAdmin;
    if (!account.isAdmin && !account.isMailSender) return false;
    const grants = await ctx.db
        .query("accessGrants")
        .withIndex("by_account", (q) => q.eq("accountId", account._id))
        .collect();
    const event = campaign.eventId ? await ctx.db.get(campaign.eventId) : null;
    if (campaign.eventId && !event) return false;
    return allows(
        { isAdmin: !!account.isAdmin, grants },
        { eventId: campaign.eventId, seriesId: event?.seriesId ?? campaign.seriesId },
        "organiser",
    );
}
