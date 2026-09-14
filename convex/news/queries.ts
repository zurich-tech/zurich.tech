import { query } from "../_generated/server";
import { requireAdmin } from "../auth/access";

/** Published news only; drafts never enter the public response. */
export const list = query({
    args: {},
    handler: async (ctx) => {
        const topics = await ctx.db.query("topics").collect();
        const posts = await ctx.db.query("posts").collect();
        return await Promise.all(
            posts
                .filter((post) => post.published)
                .map(async (post) => {
                    const content = post.published!;
                    const authors = await Promise.all(content.authors.map((id) => ctx.db.get(id)));
                    const organisations = await Promise.all(
                        content.organisations.map((id) => ctx.db.get(id)),
                    );
                    return {
                        id: post._id,
                        slug: post.slug,
                        ...content,
                        date: post.publishedAt!,
                        authors: await Promise.all(
                            authors
                                .filter((author) => author !== null)
                                .filter((author) => author.visibility === "public")
                                .map(async (author) => {
                                    const handle = (
                                        await ctx.db
                                            .query("handles")
                                            .withIndex("by_member", (q) =>
                                                q.eq("memberId", author._id),
                                            )
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
                            })),
                        topics: content.topics.map((slug) => {
                            const topic = topics.find((topic) => topic.slug === slug);
                            if (!topic) throw new Error(`Unknown article topic: ${slug}.`);
                            return { slug, name: topic.name };
                        }),
                    };
                }),
        );
    },
});

/** Team drafts and selections for the editor. */
export const workspace = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
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
