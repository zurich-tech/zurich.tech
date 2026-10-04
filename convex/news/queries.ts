import { articleTopics } from "../../src/news/model";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";
import { requireTeam } from "../auth/access";

/** Read published news only; drafts never enter the public response. */
export const list = query({
    args: {},
    handler: readPublished,
});

/** Read news previews without downloading every article body. */
export const headlines = query({
    args: {},
    handler: async (ctx) => (await readPublished(ctx)).map(({ body, ...article }) => article),
});

/** Resolve published posts in descending publication order. */
async function readPublished(ctx: QueryCtx) {
    const [topics, posts] = await Promise.all([
        ctx.db.query("topics").collect(),
        ctx.db.query("posts").collect(),
    ]);
    const published = await Promise.all(
        posts.filter((post) => post.published).map((post) => publishedPost(ctx, post, topics)),
    );

    return published.sort((a, b) => b.date - a.date || a.slug.localeCompare(b.slug));
}

/** Read one published article without loading the archive. */
export const detail = query({
    args: { slug: v.string() },
    handler: async (ctx, { slug }) => {
        const post = await ctx.db
            .query("posts")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique();
        if (!post?.published) return null;
        return publishedPost(ctx, post, await ctx.db.query("topics").collect());
    },
});

/** Expand public author, organisation and topic references identically on both read paths. */
async function publishedPost(ctx: QueryCtx, post: Doc<"posts">, topics: Doc<"topics">[]) {
    const content = post.published!;
    const authors = await Promise.all(content.authors.map((id) => ctx.db.get(id)));
    const organisations = await Promise.all(content.organisations.map((id) => ctx.db.get(id)));
    return {
        id: post._id,
        slug: post.slug,
        ...content,
        date: content.date ?? post.publishedAt!,
        authors: await Promise.all(
            authors
                .filter((author) => author !== null)
                .filter((author) => author.visibility === "public")
                .map(async (author) => {
                    const handle = (
                        await ctx.db
                            .query("handles")
                            .withIndex("by_member", (q) => q.eq("memberId", author._id))
                            .collect()
                    ).find((handle) => handle.status === "active");
                    return {
                        name: author.name,
                        url: handle ? `/members/${handle.name}` : undefined,
                    };
                }),
        ),
        organisations: organisations
            .filter((organisation) => organisation !== null)
            .map((organisation) => ({
                name: organisation.name,
                slug: organisation.slug,
                kind: organisation.kind,
                headline: organisation.headline,
                description: organisation.description,
                location: organisation.location,
                website: organisation.website,
                iconUrl: organisation.mapLogoUrl ?? organisation.logoUrl,
            })),
        topics: articleTopics(content.topics, topics),
    };
}

/** Team drafts and selections for the editor. */
export const workspace = query({
    args: {},
    handler: async (ctx) => {
        await requireTeam(ctx);
        return {
            posts: await ctx.db.query("posts").order("desc").collect(),
            members: (await ctx.db.query("members").collect())
                .filter((member) => member.visibility === "public")
                .map((member) => ({ id: member._id, name: member.name })),
            organisations: (await ctx.db.query("organisations").collect()).map((organisation) => ({
                id: organisation._id,
                name: organisation.name,
            })),
        };
    },
});
