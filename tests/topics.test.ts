import { expect, test } from "bun:test";
import { api } from "../convex/_generated/api";
import { catalogue, validateHierarchy } from "../convex/topics/catalogue";
import { descendantTopics } from "../convex/topics/hierarchy";
import { convexTest, schema, modules, member } from "./backend";

test("test_validate_parent_changes_and_preserve_omitted_parents", async () => {
    const { backend, editor } = await fixture();
    const save = api.topics.queries.save;
    await expect(
        backend.mutation(save, { slug: "ai", name: "AI", isActive: true }),
    ).rejects.toThrow("Sign in required.");
    for (const [slug, parent, message] of [
        ["ai", "missing", "Unknown parent topic: missing."],
        ["ai", "ai", "Topic hierarchy contains a cycle: ai."],
        ["ai", "agents", "Topic hierarchy contains a cycle:"],
    ]) {
        await expect(
            editor.mutation(save, { slug: slug!, name: "AI", isActive: true, parent }),
        ).rejects.toThrow(message!);
    }
    await expect(
        editor.mutation(save, { slug: "ai", name: "AI", isActive: false }),
    ).rejects.toThrow("Active topics require active parents:");
    await editor.mutation(save, { slug: "agents", name: "Agents", isActive: true });
    expect(
        (await backend.query(api.topics.queries.list, {})).find((topic) => topic.slug === "agents")!
            .parent,
    ).toBe("ai");
    await editor.mutation(save, { slug: "agents", name: "Agents", isActive: true, parent: null });
    expect(
        (await backend.query(api.topics.queries.list, {})).find((topic) => topic.slug === "agents")!
            .parent,
    ).toBeUndefined();
});

test("test_preserve_archived_parent_when_editing_an_archived_topic", async () => {
    const { backend, editor } = await fixture();
    await backend.run(async (ctx) => {
        await ctx.db.insert("topics", {
            slug: "legacy-parent",
            name: "Legacy parent",
            isActive: false,
        });
        await ctx.db.insert("topics", {
            slug: "legacy-child",
            name: "Legacy child",
            isActive: false,
            parent: "legacy-parent",
        });
    });
    const before = (await backend.query(api.topics.queries.list, {})).find(
        (topic) => topic.slug === "legacy-child",
    )!;

    // submit the retained parent option, then exercise an omitted parent update
    for (const parent of ["legacy-parent", undefined]) {
        await editor.mutation(api.topics.queries.save, {
            slug: before.slug,
            name: "Renamed child",
            isActive: false,
            ...(parent === undefined ? {} : { parent }),
        });
        expect(
            (await backend.query(api.topics.queries.list, {})).find(
                (topic) => topic.slug === before.slug,
            ),
        ).toEqual({ ...before, name: "Renamed child" });
    }
});

test("test_enforce_unique_active_labels_after_archiving_legacy_duplicates", async () => {
    const { backend, editor } = await fixture();
    await backend.run((ctx) =>
        ctx.db.insert("topics", {
            slug: "legacy-ai",
            name: "AI",
            isActive: true,
        }),
    );
    await backend.run(async (ctx) => {
        const topic = await ctx.db
            .query("topics")
            .withIndex("by_slug", (query) => query.eq("slug", "legacy-ai"))
            .unique();
        await ctx.db.patch(topic!._id, { isActive: false });
    });

    // allow editing either side of an active and archived label pair
    for (const [slug, isActive] of [
        ["ai", true],
        ["legacy-ai", false],
    ] as const) {
        await editor.mutation(api.topics.queries.save, { slug, name: "AI", isActive });
    }
    await editor.mutation(api.topics.queries.save, {
        slug: "another-legacy-ai",
        name: "ai",
        isActive: false,
    });
    const before = await backend.query(api.topics.queries.list, {});

    // reject both reactivation and creation of case insensitive active duplicates atomically
    for (const slug of ["legacy-ai", "new-ai"]) {
        await expect(
            editor.mutation(api.topics.queries.save, {
                slug,
                name: "ai",
                isActive: true,
            }),
        ).rejects.toThrow("A topic already uses this name.");
        expect(await backend.query(api.topics.queries.list, {})).toEqual(before);
    }
});

test("test_match_descendants_without_matching_parents_or_unrelated_subjects", () => {
    const topics = [...catalogue, { slug: "nested", name: "Nested", parent: "agents" }];
    expect([...descendantTopics("ai", topics)]).toEqual([
        "ai",
        "machine-learning",
        "nlp",
        "computer-vision",
        "reinforcement-learning",
        "agents",
        "nested",
    ]);
    expect([...descendantTopics("agents", topics)]).toEqual(["agents", "nested"]);
    expect([...descendantTopics("robotics", topics)]).toEqual(["robotics"]);
    expect(() => descendantTopics("missing", topics)).toThrow("Unknown topic: missing.");
    expect(() =>
        descendantTopics("a", [
            { slug: "a", parent: "b" },
            { slug: "b", parent: "a" },
        ]),
    ).toThrow("Topic hierarchy contains a cycle: a.");
    expect(() =>
        validateHierarchy([
            { slug: "a", name: "Same", isActive: true },
            { slug: "b", name: "same", isActive: true },
        ]),
    ).toThrow("A topic already uses this name.");
});

test("test_edit_organisation_topics_without_losing_omitted_assignments", async () => {
    const { backend, editor, row, id } = await fixture();
    const fields = {
        ...row,
        kind: "company" as const,
        description: "Software",
        location: "Zurich",
    };
    expect(
        (await backend.query(api.organisations.queries.detail, { slug: row.slug }))!.topics,
    ).toEqual([]);
    for (const mutation of [
        api.organisations.mutations.upsert,
        api.organisations.mutations.upsertCompany,
    ]) {
        await editor.mutation(mutation, { ...fields, id, topics: ["security", "agents"] });
        await editor.mutation(mutation, { ...fields, id });
        expect(
            (await backend.query(api.organisations.queries.detail, { slug: row.slug }))!.topics,
        ).toEqual(["security", "agents"]);
        await expect(
            editor.mutation(mutation, { ...fields, id, topics: ["ai", "agents"] }),
        ).rejects.toThrow("Choose specific topics without ancestors: ai.");
        for (const topics of [
            ["missing"],
            ["ai", "ai"],
            catalogue.slice(0, 13).map((topic) => topic.slug),
        ]) {
            const message =
                topics.length === 1
                    ? "Choose an available topic: missing."
                    : "Choose at most 12 distinct topics.";
            await expect(editor.mutation(mutation, { ...fields, id, topics })).rejects.toThrow(
                message,
            );
        }
        await editor.mutation(mutation, { ...fields, id, topics: [] });
        expect(
            (await backend.query(api.organisations.queries.detail, { slug: row.slug }))!.topics,
        ).toEqual([]);
    }
    expect(
        (await backend.query(api.organisations.queries.directory, {})).organisations[0]!.topics,
    ).toEqual([]);
});

test("test_retain_but_never_newly_assign_archived_topics", async () => {
    const { backend, editor, row, id } = await fixture();
    await backend.run(async (ctx) => {
        await ctx.db.insert("topics", { slug: "community", name: "Community", isActive: false });
        await ctx.db.patch(id, { topics: ["community"] });
    });
    const fields = {
        ...row,
        id,
        kind: "company" as const,
        description: "Software",
        location: "Zurich",
    };
    for (const mutation of [
        api.organisations.mutations.upsert,
        api.organisations.mutations.upsertCompany,
    ]) {
        await editor.mutation(mutation, { ...fields, topics: ["community"] });
    }
    await editor.mutation(api.organisations.mutations.upsert, { ...fields, topics: [] });
    for (const mutation of [
        api.organisations.mutations.upsert,
        api.organisations.mutations.upsertCompany,
    ]) {
        await expect(
            editor.mutation(mutation, { ...fields, topics: ["community"] }),
        ).rejects.toThrow("Choose an available topic: community.");
    }
});

/** Create the approved catalogue, an authorised editor and an unclassified legacy organisation. */
async function fixture() {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        for (const topic of catalogue) await ctx.db.insert("topics", { ...topic, isActive: true });
    });
    const row = { name: "Example", slug: "example", website: "https://example.org" };
    const id = await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Editor",
            searchText: "editor",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            authId: "editor",
            memberId,
            status: "active",
            isTeam: true,
            isAdmin: false,
            createdAt: 1,
            updatedAt: 1,
        });

        return ctx.db.insert("organisations", {
            ...row,
            kind: "company",
            description: "Software",
            location: "Zurich",
            updatedAt: 1,
        });
    });

    return { backend, editor: backend.withIdentity({ subject: "editor" }), row, id };
}
