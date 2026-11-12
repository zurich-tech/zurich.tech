import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Campaign fields used when authoring, reviewing or materialising messages. */
export type Campaign = Doc<"campaigns"> &
    Pick<Doc<"campaignContents">, "message" | "content" | "recipients">;

/** Editable campaign fields, including the separately stored snapshot. */
type Fields = Omit<Campaign, "_id" | "_creationTime" | "hasContent" | "recipientCount">;

/** Read a campaign's immutable delivery snapshot only when it is needed. */
export async function campaignContent(ctx: QueryCtx, id: Id<"campaigns">) {
    const contents = await ctx.db
        .query("campaignContents")
        .withIndex("by_campaign", (query) => query.eq("campaignId", id))
        .unique();
    if (!contents) throw new Error("campaign content is missing");

    return {
        message: contents.message,
        content: contents.content,
        recipients: contents.recipients,
    };
}

/** Read a complete campaign for editing or previewing. */
export async function readCampaign(ctx: QueryCtx, id: Id<"campaigns">): Promise<Campaign | null> {
    const campaign = await ctx.db.get(id);
    if (!campaign) return null;

    return { ...campaign, ...(await campaignContent(ctx, id)) };
}

/** Create operational state and campaign content together. */
export async function insertCampaign(ctx: MutationCtx, values: Fields) {
    const { message, content, recipients, ...fields } = values;
    const id = await ctx.db.insert("campaigns", {
        ...fields,
        hasContent: content ? true : undefined,
        recipientCount: recipients?.length,
    });
    await ctx.db.insert("campaignContents", { campaignId: id, message, content, recipients });

    return id;
}

/** Update authoring fields and their small operational projections atomically. */
export async function updateCampaign(
    ctx: MutationCtx,
    id: Id<"campaigns">,
    values: Partial<Fields>,
) {
    const { message, content, recipients, ...fields } = values;
    const hasMessage = Object.hasOwn(values, "message");
    const hasContent = Object.hasOwn(values, "content");
    const hasRecipients = Object.hasOwn(values, "recipients");
    if (hasMessage || hasContent || hasRecipients) {
        const row = await ctx.db
            .query("campaignContents")
            .withIndex("by_campaign", (query) => query.eq("campaignId", id))
            .unique();
        if (!row) throw new Error("campaign content is missing");
        await ctx.db.patch(row._id, {
            ...(hasMessage ? { message } : {}),
            ...(hasContent ? { content } : {}),
            ...(hasRecipients ? { recipients } : {}),
        });
    }
    await ctx.db.patch(id, {
        ...fields,
        ...(hasContent ? { hasContent: content ? true : undefined } : {}),
        ...(hasRecipients ? { recipientCount: recipients?.length } : {}),
    });
}
