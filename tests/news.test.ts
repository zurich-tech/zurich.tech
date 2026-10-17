import { convexTest, schema, modules, member } from "./backend";
import { expect, test } from "bun:test";
import { api } from "../convex/_generated/api";
import { newsTags, isNewsTag, articleTopics } from "../convex/news/tags";
import { articleParagraphs } from "../src/news/model";

/** Expose only public social profiles and geocoded public map destinations. */
test("test_link_news_entities_to_public_profiles_and_map_locations", async () => {
    const backend = convexTest(schema, modules);
    const { addressId, locationId } = await backend.run(async (ctx) => {
        const ownerId = await ctx.db.insert("organisations", {
            name: "Robotics",
            slug: "robotics",
            kind: "company",
            description: "Robots",
            location: "Zurich",
            website: "https://example.org",
            updatedAt: 1,
        });
        const addressId = await ctx.db.insert("addresses", {
            line1: "Office",
            locality: "Zurich",
            countryCode: "CH",
            latitude: 47.37,
            longitude: 8.54,
            createdAt: 1,
            updatedAt: 1,
        });
        const locationId = await ctx.db.insert("locations", {
            ownerId,
            addressId,
            name: "Office",
            visibility: "private",
        });
        for (const visibility of ["public", "private"] as const) {
            await ctx.db.insert("links", {
                ownerId,
                visibility,
                kind: visibility === "public" ? "github" : "linkedin",
                url: `https://example.org/${visibility}`,
                position: 0,
                createdAt: 1,
                updatedAt: 1,
            });
        }
        const content = {
            title: "Robotics news",
            description: "A breakthrough",
            body: "",
            kind: "post" as const,
            topics: [],
            authors: [],
            organisations: [ownerId],
        };
        await ctx.db.insert("posts", {
            slug: "robotics-news",
            draft: content,
            published: content,
            publishedAt: 1,
            createdBy: await member(ctx, { name: "Editor", searchText: "", visibility: "public" }),
            updatedAt: 1,
        });

        return { addressId, locationId };
    });
    const entity = async () =>
        (await backend.query(api.news.queries.detail, { slug: "robotics-news" }))!.organisations[0];

    expect((await entity()).socials).toEqual({ github: "https://example.org/public" });
    expect((await entity()).mapUrl).toBeUndefined();
    await backend.run((ctx) => ctx.db.patch(locationId, { visibility: "public" }));
    expect((await entity()).mapUrl).toBe("/map?organisation=robotics");
    await backend.run((ctx) => ctx.db.patch(addressId, { latitude: undefined }));
    expect((await entity()).mapUrl).toBeUndefined();

    // keep feed requests free of per-entity destination expansion
    const preview = (await backend.query(api.news.queries.headlines, {}))[0].organisations[0];
    expect(preview.socials).toBeUndefined();
    expect(preview.mapUrl).toBeUndefined();
});

/** Source line wrapping does not create extra visible paragraphs. */
test("test_render_news_paragraphs", () => {
    expect(articleParagraphs(" First sentence.\nSecond sentence.\n\n Next paragraph. ")).toEqual([
        "First sentence. Second sentence.",
        "Next paragraph.",
    ]);
    expect(articleParagraphs("")).toEqual([]);
});

/** Resolve mixed news labels without adding them to the member-interest catalogue. */
test("test_resolve_news_and_technology_tags", () => {
    expect(
        articleTopics(
            ["funding", "research", "robotics"],
            [{ slug: "robotics", name: "Robotics" }],
        ),
    ).toEqual([
        { slug: "funding", name: "Funding" },
        { slug: "research", name: "Research" },
        { slug: "robotics", name: "Robotics" },
    ]);
    expect(() => articleTopics(["unknown"], [])).toThrow("Unknown article topic: unknown.");
});

/** Preserve funding labels on older published snapshots without mutating them on read. */
test("test_read_legacy_funding_as_a_tag", async () => {
    const backend = convexTest(schema, modules);
    const id = await backend.run(async (ctx) => {
        const author = await member(ctx, { name: "Editor", searchText: "", visibility: "public" });
        const content = {
            title: "Funding",
            description: "A funding announcement.",
            body: "",
            kind: "link" as const,
            category: "funding" as const,
            topics: ["funding"],
            authors: [],
            organisations: [],
            url: "https://example.com/announcement",
        };
        return ctx.db.insert("posts", {
            slug: "funding",
            draft: content,
            published: content,
            publishedAt: 1,
            updatedAt: 1,
            createdBy: author,
        });
    });
    const article = await backend.query(api.news.queries.detail, { slug: "funding" });
    expect(article?.topics).toEqual([{ slug: "funding", name: "Funding" }]);
    expect(article).not.toHaveProperty("category");
    expect((await backend.run((ctx) => ctx.db.get(id)))?.published?.category).toBe("funding");
});

/** Preserve unified tags through draft saving, publishing and public queries. */
test("test_publish_news_tags", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
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
    });
    const editor = backend.withIdentity({ subject: "editor" });
    for (const tag of Object.keys(newsTags) as (keyof typeof newsTags)[]) {
        expect(isNewsTag(tag)).toBe(true);
        const description = "A substantial result. ".repeat(30) + "\n\nThe measured outcome.";
        const saved = await editor.mutation(api.news.mutations.save, {
            slug: tag,
            content: {
                title: newsTags[tag],
                description,
                body: "",
                kind: "link",
                url: "https://example.com/research",
                topics: [tag],
                authors: [],
                organisations: [],
            },
        });
        await editor.mutation(api.news.mutations.publish, {
            id: saved.id,
            isPublished: true,
            expectedUpdatedAt: saved.updatedAt,
        });
        const article = await backend.query(api.news.queries.detail, { slug: tag });
        expect({ topics: article?.topics, description: article?.description }).toEqual({
            topics: [{ slug: tag, name: newsTags[tag] }],
            description,
        });
    }
    expect(isNewsTag("general")).toBe(false);
    expect(isNewsTag("toString")).toBe(false);
    expect(
        (await backend.query(api.news.queries.headlines, {}))
            .flatMap((post) => post.topics.map((tag) => tag.slug))
            .sort(),
    ).toEqual(Object.keys(newsTags).sort());
    expect(await backend.run((ctx) => ctx.db.query("messages").collect())).toEqual([]);
});

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
        return {
            id,
            slug: "published",
            path: "/news/1970/01/01/published",
            ...content,
            date: 10,
            authors: [],
        };
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

/** Preserve published dates and organisation credits through subsequent editorial changes. */
test("test_preserve_news_dates_credits_and_validate_editor_changes", async () => {
    const backend = convexTest(schema, modules);
    const { recordedBy, organisationId } = await backend.run(async (ctx) => {
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
        const organisationId = await ctx.db.insert("organisations", {
            name: "zurich.tech",
            slug: "zurich-tech",
            kind: "nonprofit",
            description: "",
            website: "https://zurich.tech",
            location: "Zurich",
            ownerId: id,
            updatedAt: 1,
        });
        return { recordedBy: id, organisationId };
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
                organisations: [organisationId],
                topics: [],
            },
        },
    ];
    await backend.run((ctx) =>
        ctx.db.insert("posts", {
            slug: articles[0].slug,
            draft: { ...articles[0].content, date: 1234 },
            published: { ...articles[0].content, date: 1234 },
            publishedAt: 1234,
            updatedAt: 1234,
            createdBy: recordedBy,
        }),
    );
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
            socials: {},
            mapUrl: undefined,
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
    expect((await backend.query(api.news.queries.detail, { slug: post.slug }))?.path).toBe(
        "/news/1970/01/01/introduction",
    );
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
