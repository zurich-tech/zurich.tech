import { articleTopics } from "../../src/news/model";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";
import { requireTeam } from "../auth/access";
import { tagSlugs } from "./tags";
import { newsDate, newsPath } from "../../src/news/path";
import { readProfiles } from "../members/links";

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
        return publishedPost(ctx, post, await ctx.db.query("topics").collect(), true);
    },
});

/** Expand public references, adding organisation destinations only for article details. */
async function publishedPost(
    ctx: QueryCtx,
    post: Doc<"posts">,
    topics: Doc<"topics">[],
    isDetail = false,
) {
    const { category, ...content } = post.published!;
    const authors = await Promise.all(content.authors.map((id) => ctx.db.get(id)));
    const organisations = await Promise.all(content.organisations.map((id) => ctx.db.get(id)));
    return {
        id: post._id,
        slug: post.slug,
        path: newsPath({ slug: post.slug, date: newsDate(post) }),
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
        organisations: await Promise.all(
            organisations
                .filter((organisation) => organisation !== null)
                .map(async (organisation) => ({
                    name: organisation.name,
                    slug: organisation.slug,
                    kind: organisation.kind,
                    headline: organisation.headline,
                    description: organisation.description,
                    location: organisation.location,
                    website: organisation.website,
                    iconUrl: organisation.mapLogoUrl ?? organisation.logoUrl,
                    ...(isDetail ? await organisationLinks(ctx, organisation) : {}),
                })),
        ),
        topics: articleTopics(tagSlugs(post.published!), topics),
    };
}

/** Resolve public destinations only for article details, not every feed preview. */
async function organisationLinks(ctx: QueryCtx, organisation: Doc<"organisations">) {
    const [profiles, locations] = await Promise.all([
        readProfiles(ctx, organisation._id),
        ctx.db
            .query("locations")
            .withIndex("by_owner", (q) => q.eq("ownerId", organisation._id))
            .filter((q) => q.eq(q.field("visibility"), "public"))
            .collect(),
    ]);
    const addresses = await Promise.all(
        locations.map((location) => ctx.db.get(location.addressId)),
    );
    const isMapped = addresses.some(
        (address) => address?.latitude !== undefined && address.longitude !== undefined,
    );

    return {
        socials: profiles.socials,
        mapUrl: isMapped ? `/map?organisation=${encodeURIComponent(organisation.slug)}` : undefined,
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
