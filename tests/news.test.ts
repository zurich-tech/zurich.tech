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
            image: "https://example.com/project.jpg",
            video: "https://example.com/demo.mp4",
            caption: "Project demonstration. Credit: Example Lab",
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
    const { body, ...preview } = expected;
    expect(await backend.query(api.news.queries.headlines, {})).toEqual([preview]);
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
    expect((await backend.query(api.news.queries.headlines, {})).map((post) => post.slug)).toEqual([
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
                image: "https://example.com/project.jpg",
                video: "https://example.com/demo.mp4",
                caption: "Project demonstration. Credit: Example Lab",
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
    ).toEqual([
        {
            name: "zurich.tech",
            slug: "zurich-tech",
            kind: "nonprofit",
            headline: undefined,
            description: "",
            location: "Zurich",
            website: "https://zurich.tech",
            iconUrl: undefined,
        },
    ]);
    const editor = backend.withIdentity({ subject: "editor" });
    await expect(
        editor.mutation(api.news.mutations.save, {
            id: post._id,
            slug: post.slug,
            expectedUpdatedAt: post.updatedAt,
            content: { ...post.draft, video: "javascript:alert(1)" },
        }),
    ).rejects.toThrow("Use an HTTP or HTTPS URL.");
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
    // Dates are authored with the draft and become public only on publication.
    const current = (await backend.run((ctx) => ctx.db.get(post._id)))!;
    const date = Date.UTC(2025, 8, 12);
    const saved = await editor.mutation(api.news.mutations.save, {
        id: post._id,
        slug: post.slug,
        expectedUpdatedAt: current.updatedAt,
        content: { ...current.draft, date },
    });
    expect((await backend.query(api.news.queries.detail, { slug: post.slug }))?.date).toBe(1234);
    await editor.mutation(api.news.mutations.publish, {
        id: post._id,
        isPublished: true,
        expectedUpdatedAt: saved.updatedAt,
    });
    expect((await backend.query(api.news.queries.list, {}))[0].date).toBe(date);
    expect((await backend.query(api.news.queries.detail, { slug: post.slug }))?.date).toBe(date);
    const published = (await backend.run((ctx) => ctx.db.get(post._id)))!;
    expect(published.publishedAt).toBe(1234);
    await expect(
        editor.mutation(api.news.mutations.save, {
            id: post._id,
            slug: post.slug,
            expectedUpdatedAt: published.updatedAt,
            content: { ...published.draft, date: Infinity },
        }),
    ).rejects.toThrow("valid publication date");
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
});
