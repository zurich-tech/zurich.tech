import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { content } from "./content";
import { validateContent } from "./validation";

/** Import reviewed sources without replacing website edits or sending communications. */
export const apply = internalMutation({
    args: {
        recordedBy: v.id("members"),
        apply: v.boolean(),
        articles: v.array(
            v.object({
                slug: v.string(),
                date: v.number(),
                content: v.object({
                    ...content.fields,
                    authors: v.array(v.string()),
                    organisations: v.array(v.string()),
                }),
            }),
        ),
    },
    handler: async (ctx, args) => {
        const account = await ctx.db
            .query("accounts")
            .filter((q) => q.eq(q.field("memberId"), args.recordedBy))
            .unique();
        if (!account?.isAdmin || account.status !== "active")
            throw new Error("Choose an active administrator to record the import.");
        const result = { created: 0, unchanged: 0 };
        const slugs = new Set<string>();
        for (const article of args.articles) {
            if (
                !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) ||
                ["edit", "manage", "new"].includes(article.slug) ||
                !Number.isFinite(article.date) ||
                slugs.has(article.slug)
            )
                throw new Error(`Invalid or repeated article: ${article.slug}.`);
            slugs.add(article.slug);
            const authors = [];
            const credits = [];
            for (const name of article.content.authors) {
                const handle = await ctx.db
                    .query("handles")
                    .withIndex("by_name", (q) => q.eq("name", name))
                    .unique();
                const member =
                    handle?.status === "active" ? await ctx.db.get(handle.memberId) : null;
                if (!member || member.visibility !== "public")
                    throw new Error(`Public author not found: ${name}.`);
                authors.push(member._id);
            }
            for (const slug of article.content.organisations) {
                const organisation = await ctx.db
                    .query("organisations")
                    .withIndex("by_slug", (q) => q.eq("slug", slug))
                    .unique();
                if (!organisation) throw new Error(`Organisation not found: ${slug}.`);
                credits.push(organisation._id);
            }
            const existing = await ctx.db
                .query("posts")
                .withIndex("by_slug", (q) => q.eq("slug", article.slug))
                .unique();
            const value = await validateContent(
                ctx,
                { ...article.content, authors, organisations: credits },
                existing?.draft.topics,
            );
            if (existing) {
                const matches = (snapshot: typeof existing.published) =>
                    snapshot &&
                    (Object.keys(content.fields) as (keyof typeof value)[]).every(
                        (key) => JSON.stringify(snapshot[key]) === JSON.stringify(value[key]),
                    );
                if (
                    existing.publishedAt !== article.date ||
                    !matches(existing.draft) ||
                    !matches(existing.published)
                )
                    throw new Error(
                        `News conflict: ${article.slug}. Edit the existing post on the website; the import will not overwrite it.`,
                    );
                result.unchanged++;
            } else {
                if (args.apply)
                    await ctx.db.insert("posts", {
                        slug: article.slug,
                        draft: value,
                        published: value,
                        publishedAt: article.date,
                        createdBy: args.recordedBy,
                        updatedAt: Date.now(),
                    });
                result.created++;
            }
        }
        return result;
    },
});
