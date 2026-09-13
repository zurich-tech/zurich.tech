import { v, ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { requireTeam } from "../auth/access";
import { content } from "./content";
import { articles } from "../../src/news/articles.generated";

/** Save a draft without changing the published snapshot. */
export const save = mutation({
    args: {
        id: v.optional(v.id("posts")),
        slug: v.string(),
        content,
        expectedUpdatedAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const account = await requireTeam(ctx);
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
        if (
            (duplicate && duplicate._id !== args.id) ||
            articles.some((article) => article.slug === args.slug)
        )
            throw new ConvexError("This slug is already used.");

        // validate URLs and bounded text before storing content
        const value = {
            ...args.content,
            title: args.content.title.trim(),
            tags: [
                ...new Set(
                    args.content.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
                ),
            ],
        };
        if (
            !value.title ||
            value.title.length > 200 ||
            value.description.length > 500 ||
            value.body.length > 50000
        )
            throw new ConvexError("Check the title, summary and body lengths.");
        if (value.kind === "link" && !value.url) throw new ConvexError("Enter the original URL.");
        for (const url of [value.url, value.image].filter(Boolean)) {
            let parsed: URL;
            try {
                parsed = new URL(url!);
            } catch {
                throw new ConvexError("Enter a valid URL.");
            }
            if (
                !["https:", "http:"].includes(parsed.protocol) ||
                parsed.username ||
                parsed.password
            )
                throw new ConvexError("Use an HTTP or HTTPS URL.");
        }
        if (
            value.tags.length > 12 ||
            value.tags.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))
        )
            throw new ConvexError("Use up to 12 tags, with words separated by hyphens.");
        if (!value.authors.length) throw new ConvexError("Select an author.");
        for (const id of value.authors) {
            const author = await ctx.db.get(id);
            if (!author || author.visibility !== "public")
                throw new ConvexError("Choose authors with public profiles.");
        }
        for (const id of value.organisations)
            if (!(await ctx.db.get(id))) throw new ConvexError("Organisation not found.");
        if (value.kind === "post") value.url = undefined;
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
        await requireTeam(ctx);
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
        await requireTeam(ctx);
        const post = await ctx.db.get(args.id);
        if (!post) throw new ConvexError("Post not found.");
        if (post.updatedAt !== args.expectedUpdatedAt)
            throw new ConvexError("The draft changed. Reload before deleting.");
        if (post.publishedAt)
            throw new ConvexError("Unpublish this post to remove it from the feed.");
        await ctx.db.delete(args.id);
    },
});
