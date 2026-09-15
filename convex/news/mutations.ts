import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { requireAdmin } from "../auth/access";
import { content } from "./content";
import { validateContent } from "./validation";

/** Save a draft without changing the published snapshot. */
export const save = mutation({
    args: {
        id: v.optional(v.id("posts")),
        slug: v.string(),
        content,
        expectedUpdatedAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const account = await requireAdmin(ctx);
        const existing = args.id ? await ctx.db.get(args.id) : null;
        if (args.id && !existing) throw new ConvexError("Post not found.");
        if (existing && existing.updatedAt !== args.expectedUpdatedAt)
            throw new ConvexError("Someone else edited this post. Reload before saving.");
        if (
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug) ||
            ["edit", "manage", "new"].includes(args.slug)
        )
            throw new ConvexError("Enter a valid slug.");
        if (existing?.publishedAt && existing.slug !== args.slug)
            throw new ConvexError("Published URLs cannot be changed.");
        const duplicate = await ctx.db
            .query("posts")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .unique();
        if (duplicate && duplicate._id !== args.id)
            throw new ConvexError("This slug is already used.");

        const value = await validateContent(ctx, args.content, existing?.draft.topics);
        const updatedAt = Math.max(Date.now(), (existing?.updatedAt ?? 0) + 1);
        const id = existing
            ? existing._id
            : await ctx.db.insert("posts", {
                  slug: args.slug,
                  draft: value,
                  createdBy: account.memberId,
                  updatedAt,
              });
        if (existing) await ctx.db.patch(id, { slug: args.slug, draft: value, updatedAt });
        return { id, updatedAt };
    },
});

/** Publish or withdraw explicitly; neither operation sends communications. */
export const publish = mutation({
    args: { id: v.id("posts"), isPublished: v.boolean(), expectedUpdatedAt: v.number() },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const post = await ctx.db.get(args.id);
        if (!post) throw new ConvexError("Post not found.");
        if (post.updatedAt !== args.expectedUpdatedAt)
            throw new ConvexError("The draft changed. Reload before publishing.");
        if (args.isPublished && post.draft.kind === "post" && !post.draft.body.trim())
            throw new ConvexError("Write the post before publishing.");
        const updatedAt = Math.max(Date.now(), post.updatedAt + 1);
        await ctx.db.patch(post._id, {
            published: args.isPublished ? post.draft : undefined,
            publishedAt: args.isPublished ? (post.publishedAt ?? Date.now()) : post.publishedAt,
            updatedAt,
        });
        return { updatedAt };
    },
});

/** Only unpublished, never-published drafts may be deleted. */
export const remove = mutation({
    args: { id: v.id("posts"), expectedUpdatedAt: v.number() },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const post = await ctx.db.get(args.id);
        if (!post) throw new ConvexError("Post not found.");
        if (post.updatedAt !== args.expectedUpdatedAt)
            throw new ConvexError("The draft changed. Reload before deleting.");
        if (post.publishedAt)
            throw new ConvexError("Unpublish this post to remove it from the feed.");
        await ctx.db.delete(args.id);
    },
});
