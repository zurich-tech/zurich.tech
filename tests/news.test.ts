import { convexTest, schema, modules, member } from "./backend";
import { expect, test } from "bun:test";
import { api, internal } from "../convex/_generated/api";

/** Both public read paths expose published content only, including author privacy. */
test("news detail matches the feed and excludes drafts and private authors", async () => {
    const backend = convexTest(schema, modules);
    const expected = await backend.run(async (ctx) => {
        const author = await member(ctx, {
            name: "Private author",
            visibility: "private",
            searchText: "",
        });
        const content = {
            title: "Published",
            description: "One sentence.",
            body: "Context.",
            kind: "post" as const,
            topics: [],
            authors: [author],
            organisations: [],
        };
        const id = await ctx.db.insert("posts", {
            slug: "published",
            draft: { ...content, title: "Unpublished revision" },
            published: content,
            publishedAt: 10,
            updatedAt: 11,
            createdBy: author,
        });
        await ctx.db.insert("posts", {
            slug: "draft",
            draft: content,
            updatedAt: 11,
            createdBy: author,
        });
        return { id, slug: "published", ...content, date: 10, authors: [] };
    });
    expect(await backend.query(api.news.queries.list, {})).toEqual([expected]);
    expect(await backend.query(api.news.queries.detail, { slug: "published" })).toEqual(expected);
    expect(await backend.query(api.news.queries.detail, { slug: "draft" })).toBeNull();
    expect(await backend.query(api.news.queries.detail, { slug: "missing" })).toBeNull();
    await backend.run(async (ctx) => {
        const post = (await ctx.db.get(expected.id))!;
        await ctx.db.insert("posts", {
            slug: "newer",
            draft: post.draft,
            published: post.published,
            publishedAt: 20,
            updatedAt: 20,
            createdBy: post.createdBy,
        });
    });
    expect((await backend.query(api.news.queries.list, {})).map((post) => post.slug)).toEqual([
        "newer",
        "published",
    ]);
});

/** Import sources become normal editable posts without duplicate rows or silent overwrites. */
test("news imports preserve dates, credit organisations and protect subsequent edits", async () => {
    const backend = convexTest(schema, modules);
    const recordedBy = await backend.run(async (ctx) => {
        const id = await member(ctx, { name: "Editor", searchText: "", visibility: "public" });
        await ctx.db.insert("accounts", {
            authId: "editor",
            memberId: id,
            status: "active",
            isAdmin: true,
            isTeam: true,
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("organisations", {
            name: "zurich.tech",
            slug: "zurich-tech",
            kind: "nonprofit",
            description: "",
            website: "https://zurich.tech",
            location: "Zurich",
            ownerId: id,
            updatedAt: 1,
        });
        return id;
    });
    const articles = [
        {
            slug: "introduction",
            date: 1234,
            content: {
                title: "Introduction",
                description: "Our community.",
                body: "Welcome.",
                kind: "post" as const,
                authors: [],
                organisations: ["zurich-tech"],
                topics: [],
            },
        },
    ];
    const args = { recordedBy, articles, apply: false };
    expect(await backend.mutation(internal.news.imports.apply, args)).toEqual({
        created: 1,
        unchanged: 0,
    });
    expect(await backend.query(api.news.queries.list, {})).toEqual([]);
    expect(await backend.mutation(internal.news.imports.apply, { ...args, apply: true })).toEqual({
        created: 1,
        unchanged: 0,
    });
    expect(await backend.mutation(internal.news.imports.apply, { ...args, apply: true })).toEqual({
        created: 0,
        unchanged: 1,
    });
    const post = (await backend.run((ctx) => ctx.db.query("posts").unique()))!;
    expect(post.publishedAt).toBe(1234);
    expect(
        (await backend.query(api.news.queries.detail, { slug: "introduction" }))?.organisations,
    ).toEqual([{ name: "zurich.tech", slug: "zurich-tech" }]);
    const editor = backend.withIdentity({ subject: "editor" });
    await editor.mutation(api.news.mutations.save, {
        id: post._id,
        slug: post.slug,
        expectedUpdatedAt: post.updatedAt,
        content: { ...post.draft, title: "Edited on the website" },
    });
    await expect(
        backend.mutation(internal.news.imports.apply, { ...args, apply: true }),
    ).rejects.toThrow("News conflict: introduction");
    expect(await backend.run((ctx) => ctx.db.query("posts").collect())).toHaveLength(1);
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
});
