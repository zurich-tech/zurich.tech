import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";

/** Return only published linked stories, with stable URLs, limits and honest totals. */
test("test_read_map_news_without_drafts_or_unrelated_stories", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const author = await member(ctx, { name: "Editor", searchText: "", visibility: "private" });
        const organisation = await ctx.db.insert("organisations", {
            name: "Example",
            description: "Robotics",
            location: "Zurich",
            website: "https://example.com",
            slug: "example",
            kind: "startup",
            updatedAt: 1,
        });
        const second = await ctx.db.insert("organisations", {
            name: "Empty",
            description: "Robotics",
            location: "Zurich",
            website: "https://example.com",
            slug: "empty",
            kind: "company",
            updatedAt: 1,
        });
        for (let index = 1; index <= 5; index++) {
            const content = {
                kind: "link" as const,
                title: `Story ${index}`,
                description: "Public summary",
                body: "Long body not needed by the map",
                authors: [],
                topics: [],
                organisations: index === 4 ? [] : [organisation],
                date: Date.UTC(2026, 9, index),
                url: "https://example.com/news",
                image: "https://example.com/robot.jpg",
            };
            await ctx.db.insert("posts", {
                slug: `story-${index}`,
                draft: { ...content, title: "Unpublished edit" },
                published: index === 5 ? undefined : content,
                date: Date.UTC(2026, 8, index),
                publishedAt: Date.UTC(2026, 9, index),
                updatedAt: 1,
                createdBy: author,
            });
        }
        // link the newest story to both tenants to exercise exact shared totals
        const newest = await ctx.db
            .query("posts")
            .withIndex("by_slug", (q) => q.eq("slug", "story-3"))
            .unique();
        await ctx.db.patch(newest!._id, {
            published: { ...newest!.published!, organisations: [organisation, second] },
        });
    });

    expect(
        await backend.query(api.places.map.activity, {
            slugs: ["example", "example", "empty", "missing"],
        }),
    ).toEqual([
        {
            slug: "example",
            newsCount: 3,
            news: [
                {
                    title: "Story 3",
                    date: Date.UTC(2026, 9, 3),
                    image: "https://example.com/robot.jpg",
                    path: "/news/2026/09/03/story-3",
                },
                {
                    title: "Story 2",
                    date: Date.UTC(2026, 9, 2),
                    image: "https://example.com/robot.jpg",
                    path: "/news/2026/09/02/story-2",
                },
            ],
            jobCount: 0,
            jobs: [],
        },
        {
            slug: "empty",
            newsCount: 1,
            news: [
                {
                    title: "Story 3",
                    date: Date.UTC(2026, 9, 3),
                    image: "https://example.com/robot.jpg",
                    path: "/news/2026/09/03/story-3",
                },
            ],
            jobCount: 0,
            jobs: [],
        },
    ]);
    expect(
        await backend.query(api.places.map.activity, {
            slugs: ["example", "empty", "example", "missing"],
            combined: true,
        }),
    ).toEqual([
        {
            slug: null,
            newsCount: 3,
            jobCount: 0,
            jobs: [],
            news: [
                {
                    title: "Story 3",
                    date: Date.UTC(2026, 9, 3),
                    image: "https://example.com/robot.jpg",
                    path: "/news/2026/09/03/story-3",
                    organisation: "Example, Empty",
                },
                {
                    title: "Story 2",
                    date: Date.UTC(2026, 9, 2),
                    image: "https://example.com/robot.jpg",
                    path: "/news/2026/09/02/story-2",
                    organisation: "Example",
                },
            ],
        },
    ]);
    expect(await backend.query(api.places.map.activity, { slugs: [] })).toEqual([]);

    // include another tenant's own story before applying the two-story limit
    await backend.run(async (ctx) => {
        const second = await ctx.db
            .query("organisations")
            .withIndex("by_slug", (q) => q.eq("slug", "empty"))
            .unique();
        const story = await ctx.db
            .query("posts")
            .withIndex("by_slug", (q) => q.eq("slug", "story-4"))
            .unique();
        await ctx.db.patch(story!._id, {
            published: { ...story!.published!, organisations: [second!._id] },
        });
    });
    expect(
        await backend.query(api.places.map.activity, {
            slugs: ["example", "empty"],
            combined: true,
        }),
    ).toEqual([
        {
            slug: null,
            newsCount: 4,
            jobCount: 0,
            jobs: [],
            news: [
                {
                    title: "Story 4",
                    date: Date.UTC(2026, 9, 4),
                    image: "https://example.com/robot.jpg",
                    path: "/news/2026/09/04/story-4",
                    organisation: "Empty",
                },
                {
                    title: "Story 3",
                    date: Date.UTC(2026, 9, 3),
                    image: "https://example.com/robot.jpg",
                    path: "/news/2026/09/03/story-3",
                    organisation: "Example, Empty",
                },
            ],
        },
    ]);
    expect(
        await backend.query(api.places.map.activity, { slugs: ["missing"], combined: true }),
    ).toEqual([]);
});

/** Match the job board's visibility and exclude closed, stale, expired and unapproved roles. */
test("test_read_only_open_map_jobs", async () => {
    const backend = convexTest(schema, modules);
    const now = Date.now();
    await backend.run(async (ctx) => {
        const owner = await member(ctx, { name: "Owner", searchText: "", visibility: "private" });
        const organisationId = await ctx.db.insert("organisations", {
            name: "Example",
            description: "Robotics",
            location: "Zurich",
            website: "https://example.com",
            slug: "example",
            kind: "company",
            updatedAt: 1,
        });
        const sponsor = await ctx.db.insert("sponsorships", {
            organisationId,
            tier: "gold",
            status: "active",
            isPublic: true,
            createdAt: 1,
            updatedAt: 1,
        });
        await ctx.db.insert("sponsorshipTerms", {
            sponsorshipId: sponsor,
            tier: "gold",
            contribution: { kind: "money", amount: 5000 },
            startsAt: now - 1000,
            endsAt: now + 86400000,
            reason: "Test",
            recordedBy: owner,
            createdAt: 1,
        });
        const scenarios = [
            "one",
            "two",
            "three",
            "four",
            "closed",
            "draft",
            "stale",
            "deadline",
            "unfunded",
        ];
        for (const [index, slug] of scenarios.entries()) {
            await ctx.db.insert("jobs", {
                organisationId,
                title: slug,
                slug,
                summary: "Public role",
                description: "Private draft must not leak",
                locations: [{ locality: "Zurich", countryCode: "CH" }],
                workplace: "onsite",
                engagement: "employment",
                topics: [],
                skills: [],
                languages: [],
                application: { kind: "url", url: "https://example.com/apply" },
                billingEmail: "private@example.com",
                createdBy: owner,
                updatedBy: owner,
                createdAt: 1,
                updatedAt: 1,
                status: slug === "closed" || slug === "draft" ? slug : "published",
                publishedAt: now - index,
                confirmedAt: slug === "stale" ? 1 : now,
                applicationDeadline: slug === "deadline" ? 1 : undefined,
                sponsorshipId: slug === "unfunded" ? undefined : sponsor,
            });
        }
    });

    expect(await backend.query(api.places.map.activity, { slugs: ["example"] })).toEqual([
        {
            slug: "example",
            newsCount: 0,
            news: [],
            jobCount: 4,
            jobs: [
                ...["one", "two"].map((title) => ({
                    title,
                    path: `/jobs/${title}`,
                    locations: [{ locality: "Zurich", countryCode: "CH" }],
                    workplace: "onsite" as const,
                })),
            ],
        },
    ]);
    const combined = await backend.query(api.places.map.activity, {
        slugs: ["example", "example"],
        combined: true,
    });
    const signals = await backend.query(api.places.map.signals, {});
    expect(signals.hiring).toHaveLength(1);
    expect(signals.news).toEqual([]);
    expect(signals.fundraising).toEqual([]);
    expect(combined).toEqual([
        {
            slug: null,
            newsCount: 0,
            news: [],
            jobCount: 4,
            jobs: ["one", "two"].map((title) => ({
                title,
                path: `/jobs/${title}`,
                locations: [{ locality: "Zurich", countryCode: "CH" }],
                workplace: "onsite",
                organisation: "Example",
            })),
        },
    ]);
});

test("map signals use published story dates and explicit fundraising topics", async () => {
    const backend = convexTest(schema, modules);
    const expected = await backend.run(async (ctx) => {
        const author = await member(ctx, { name: "Editor", searchText: "", visibility: "private" });
        const included = { news: [] as string[], fundraising: [] as string[] };
        for (const [slug, age, isFunding, isPublished] of [
            ["recent", 10, false, true],
            ["funding", 30, true, true],
            ["older-funding", 100, true, true],
            ["old", 366, true, true],
            ["future", -2, true, true],
            ["draft", 1, true, false],
        ] as const) {
            const organisation = await ctx.db.insert("organisations", {
                name: slug,
                slug,
                kind: "startup",
                description: "",
                location: "Zurich",
                website: "https://example.com",
                updatedAt: 1,
            });
            const content = {
                kind: "link" as const,
                title: slug,
                description: "",
                body: "",
                authors: [],
                organisations: [organisation],
                topics: isFunding ? ["funding"] : [],
                date: Date.now(),
            };
            await ctx.db.insert("posts", {
                slug,
                draft: content,
                published: isPublished ? content : undefined,
                date: Date.now() - age * 86_400_000,
                publishedAt: Date.now(),
                updatedAt: 1,
                createdBy: author,
            });
            if (slug === "recent" || slug === "funding") included.news.push(organisation);
            if (slug === "funding" || slug === "older-funding")
                included.fundraising.push(organisation);
        }

        return included;
    });
    const signals = await backend.query(api.places.map.signals, {});
    expect(new Set(signals.news)).toEqual(new Set(expected.news));
    expect(new Set(signals.fundraising)).toEqual(new Set(expected.fundraising));
    expect(signals.hiring).toEqual([]);
});
