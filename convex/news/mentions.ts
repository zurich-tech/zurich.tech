import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { newsDate, newsPath } from "./path";

/** Project the public references shared by map previews and activity filters. */
export function mentions(post: Doc<"posts">) {
    if (!post.published) return [];
    const content = post.published;
    const originalDate = newsDate(post);
    const fields = {
        postId: post._id,
        slug: post.slug,
        title: content.title,
        date: content.date ?? post.publishedAt!,
        originalDate,
        path: newsPath({ slug: post.slug, date: originalDate }),
        image: content.image,
        isFunding: content.topics.includes("funding") || content.category === "funding",
    };

    return [...new Set(content.organisations)].map((organisationId) => ({
        ...fields,
        organisationId,
    }));
}

/** Replace public mentions in the same transaction as publication or withdrawal. */
export async function updateMentions(ctx: MutationCtx, post: Doc<"posts">) {
    const existing = await ctx.db
        .query("newsMentions")
        .withIndex("by_post", (query) => query.eq("postId", post._id))
        .collect();
    for (const row of existing) await ctx.db.delete(row._id);
    for (const row of mentions(post)) await ctx.db.insert("newsMentions", row);
}
