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
        await ctx.db.insert("organisations", {
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
        { slug: "empty", newsCount: 0, news: [], jobCount: 0, jobs: [] },
    ]);
    expect(await backend.query(api.places.map.activity, { slugs: [] })).toEqual([]);
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
});
