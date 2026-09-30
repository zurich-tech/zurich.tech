import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { record } from "./history";

/** Count terminal messages separately from provider outcomes. */
function counts(row: Doc<"messages">) {
    return {
        finished: Number(row.status !== "queued"),
        accepted: Number(row.status === "accepted"),
        delivered: Number(row.outcome === "delivered"),
        failed: Number(
            row.status === "failed" ||
                ["bounced", "complained", "failed", "suppressed"].includes(row.outcome ?? ""),
        ),
        skipped: Number(row.status === "skipped"),
    };
}

/** Update a message and campaign progress in the same transaction. */
export async function updateMessage(
    ctx: MutationCtx,
    row: Doc<"messages">,
    patch: Partial<Omit<Doc<"messages">, "_id" | "_creationTime">>,
) {
    await ctx.db.patch(row._id, patch);
    if (patch.outcome !== undefined || patch.status === "failed")
        await record(ctx, { ...row, ...patch });
    if (!row.campaignId || row.isTest) return;
    const campaign = await ctx.db.get(row.campaignId);
    if (!campaign) return;

    // apply only the state change, making duplicate callbacks harmless
    const before = counts(row);
    const after = counts({ ...row, ...patch });
    const finished = (campaign.finished ?? 0) + after.finished - before.finished;
    await ctx.db.patch(campaign._id, {
        finished,
        accepted: (campaign.accepted ?? 0) + after.accepted - before.accepted,
        delivered: (campaign.delivered ?? 0) + after.delivered - before.delivered,
        failed: (campaign.failed ?? 0) + after.failed - before.failed,
        skipped: (campaign.skipped ?? 0) + after.skipped - before.skipped,
        ...(campaign.status === "queued" && finished === campaign.recipients?.length
            ? { status: "completed" as const }
            : {}),
    });
}
