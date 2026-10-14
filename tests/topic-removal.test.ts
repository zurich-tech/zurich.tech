import { expect, test } from "bun:test";
import { makeFunctionReference } from "convex/server";
import { convexTest, member, modules, schema } from "./backend";

const apply = makeFunctionReference<"mutation">("topics/removal:apply");

test("test_preview_remove_rejected_topics_and_preserve_unrelated_content", async () => {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const owner = await member(ctx, {
            name: "Test",
            searchText: "test",
            visibility: "private",
        });
        const topicIds = [];
        for (const slug of ["ai-safety", "ai-ethics", "robotics"])
            topicIds.push(await ctx.db.insert("topics", { slug, name: slug, isActive: true }));
        const series = await ctx.db.insert("series", {
            slug: "test",
            name: "Test",
            description: "Keep this",
            status: "active",
            topics: ["robotics", "ai-ethics"],
        });
        const account = await ctx.db.insert("accounts", {
            authId: "test",
            memberId: owner,
            interests: ["ai-safety", "robotics"],
            isTeam: false,
            isAdmin: false,
            status: "active",
            createdAt: 1,
            updatedAt: 1,
        });
        const content = {
            title: "Keep this",
            description: "Unchanged",
            body: "Unchanged body",
            kind: "post" as const,
            topics: ["ai-safety", "robotics"],
            authors: [],
            organisations: [],
        };
        const post = await ctx.db.insert("posts", {
            slug: "test",
            draft: content,
            published: { ...content, topics: ["ai-ethics"] },
            publishedAt: 1,
            updatedAt: 1,
            createdBy: owner,
        });

        return { topicIds, series, account, post };
    });
    const before = await backend.run(async (ctx) => ({
        series: await ctx.db.get(ids.series),
        account: await ctx.db.get(ids.account),
        post: await ctx.db.get(ids.post),
    }));
    const counts = {
        subscriptions: 0,
        events: 0,
        series: 1,
        seriesRevisions: 0,
        submissions: 0,
        accounts: 1,
        posts: 1,
        jobs: 0,
        schedules: 0,
        topics: 2,
    };
    expect(await backend.mutation(apply, { apply: false })).toEqual({ applied: false, counts });
    expect(await backend.run(async (ctx) => ctx.db.get(ids.post))).toEqual(before.post);
    expect(await backend.mutation(apply, { apply: true })).toEqual({ applied: true, counts });
    expect(
        await backend.run(async (ctx) => ({
            series: await ctx.db.get(ids.series),
            account: await ctx.db.get(ids.account),
            post: await ctx.db.get(ids.post),
        })),
    ).toEqual({
        series: { ...before.series!, topics: ["robotics"] },
        account: { ...before.account!, interests: ["robotics"] },
        post: {
            ...before.post!,
            draft: { ...before.post!.draft, topics: ["robotics"] },
            published: { ...before.post!.published!, topics: [] },
        },
    });
    expect(
        await backend.run(async (ctx) =>
            (await ctx.db.query("topics").collect()).map((row) => row.slug),
        ),
    ).toEqual(["robotics"]);
    expect(await backend.mutation(apply, { apply: true })).toEqual({
        applied: true,
        counts: Object.fromEntries(Object.keys(counts).map((key) => [key, 0])),
    });
});

test("test_refuse_to_broaden_subscription_preferences", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        await ctx.db.insert("topics", { slug: "ai-safety", name: "AI safety", isActive: true });
        await ctx.db.insert("subscriptions", {
            email: "test@example.invalid",
            status: "subscribed",
            token: "test",
            topics: ["ai-safety"],
            createdAt: 1,
            updatedAt: 1,
        });
    });
    expect((await backend.mutation(apply, { apply: false })).counts.subscriptions).toBe(1);
    await expect(backend.mutation(apply, { apply: true })).rejects.toThrow(
        "Review affected subscription preferences before removing topics.",
    );
    expect(
        await backend.run(async (ctx) =>
            (await ctx.db.query("topics").collect()).map((row) => row.slug),
        ),
    ).toEqual(["ai-safety"]);
});
