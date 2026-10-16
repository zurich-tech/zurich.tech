import { expect, test } from "bun:test";
import { makeFunctionReference } from "convex/server";
import { api } from "../convex/_generated/api";
import { catalogue, validateHierarchy } from "../convex/topics/catalogue";
import { descendantTopics } from "../convex/topics/hierarchy";
import { organisationKinds } from "../convex/organisations/kinds";
import { convexTest, schema, modules, member } from "./backend";

/** Install only the approved fixed catalogue. */
const install = makeFunctionReference<"mutation">("topics/imports:install");

/** Assign reviewed subjects without overwriting curation. */
const classify = makeFunctionReference<"mutation">("organisations/imports:classify");

/** Review evidence shared by classification scenarios. */
const review = {
    expectedKind: "company" as const,
    kind: "company" as const,
    reason: "Official product description.",
    sources: ["https://example.org/products"],
    confidence: "high" as const,
};

test("test_install_exact_approved_hierarchy_and_preserve_legacy_references", async () => {
    const backend = convexTest(schema, modules);
    const ids = await backend.run(async (ctx) => {
        const topic = await ctx.db.insert("topics", {
            slug: "community",
            name: "Community",
            isActive: true,
        });
        const data = await ctx.db.insert("topics", {
            slug: "data-engineering",
            name: "Data engineering",
            isActive: true,
        });
        const series = await ctx.db.insert("series", {
            slug: "legacy",
            name: "Legacy",
            description: "Existing references",
            status: "active",
            topics: ["community", "data-engineering"],
        });

        return { topic, data, series };
    });
    const before = await backend.run((ctx) => ctx.db.query("topics").collect());
    expect(await backend.mutation(install, { apply: false })).toEqual({
        applied: false,
        created: 33,
        updated: 1,
        archived: 1,
        unchanged: 0,
    });
    expect(await backend.run((ctx) => ctx.db.query("topics").collect())).toEqual(before);
    expect(await backend.mutation(install, { apply: true })).toEqual({
        applied: true,
        created: 33,
        updated: 1,
        archived: 1,
        unchanged: 0,
    });
    const topics = await backend.query(api.topics.queries.list, {});
    expect(
        topics
            .filter((topic) => topic.isActive)
            .map(({ slug, name, parent }) => [slug, name, parent ?? null])
            .sort(),
    ).toEqual(
        [
            ["ai", "AI", null],
            ["machine-learning", "ML", "ai"],
            ["nlp", "NLP", "ai"],
            ["computer-vision", "CV", "ai"],
            ["reinforcement-learning", "RL", "ai"],
            ["agents", "Agents", "ai"],
            ["software-engineering", "Software", null],
            ["distributed-systems", "Systems", "software-engineering"],
            ["cloud", "Cloud", "software-engineering"],
            ["data-engineering", "Data", null],
            ["databases", "Databases", "data-engineering"],
            ["analytics", "Analytics", "data-engineering"],
            ["security", "Security", null],
            ["cryptography", "Cryptography", "security"],
            ["hardware", "Hardware", null],
            ["electronics", "Electronics", "hardware"],
            ["semiconductors", "Semiconductors", "hardware"],
            ["embedded", "Embedded", "hardware"],
            ...[
                "robotics",
                "quantum",
                "photonics",
                "biotech",
                "medtech",
                "materials",
                "manufacturing",
                "fintech",
                "space",
                "telecom",
                "graphics",
                "games",
                "startups",
            ].map((slug) => [slug, slug[0]!.toUpperCase() + slug.slice(1), null]),
            ["climate-tech", "Energy", null],
            ["product-design", "Design", null],
            ["ai-policy", "Policy", null],
        ].sort(),
    );
    expect(await backend.run((ctx) => ctx.db.get(ids.topic))).toEqual({
        ...before[0]!,
        isActive: false,
    });
    expect((await backend.run((ctx) => ctx.db.get(ids.data)))!.slug).toBe("data-engineering");
    expect((await backend.run((ctx) => ctx.db.get(ids.series)))!.topics).toEqual([
        "community",
        "data-engineering",
    ]);
    expect(await backend.mutation(install, { apply: true })).toEqual({
        applied: true,
        created: 0,
        updated: 0,
        archived: 0,
        unchanged: 35,
    });
    expect(organisationKinds.space).toBe("Hub");
});

test("test_reject_invalid_or_unbounded_catalogues_without_writes", async () => {
    for (const problem of ["duplicate", "unknown", "cycle", "oversized"] as const) {
        const backend = convexTest(schema, modules);
        await backend.run(async (ctx) => {
            if (problem === "oversized") {
                for (let index = 0; index < 101; index++)
                    await ctx.db.insert("topics", {
                        slug: `legacy-${index}`,
                        name: `Legacy ${index}`,
                        isActive: false,
                    });
            } else {
                await ctx.db.insert("topics", {
                    slug: "legacy",
                    name: "Legacy",
                    isActive: true,
                    ...(problem === "unknown"
                        ? { parent: "missing" }
                        : problem === "cycle"
                          ? { parent: "legacy" }
                          : {}),
                });
                if (problem === "duplicate")
                    await ctx.db.insert("topics", {
                        slug: "legacy",
                        name: "Other",
                        isActive: true,
                    });
            }
        });
        const before = await backend.run((ctx) => ctx.db.query("topics").collect());
        const message = {
            duplicate: "Topic keys must be unique.",
            unknown: "Unknown parent topic: missing.",
            cycle: "Topic hierarchy contains a cycle: legacy.",
            oversized: "Review catalogues larger than 100 topics separately.",
        }[problem];
        for (const isApply of [false, true]) {
            await expect(backend.mutation(install, { apply: isApply })).rejects.toThrow(message);
            expect(await backend.run((ctx) => ctx.db.query("topics").collect())).toEqual(before);
        }
    }
});

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
    await backend.mutation(install, { apply: true });

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

test("test_preview_classification_and_repeat_without_overwriting_profiles", async () => {
    const { backend, row, id } = await fixture();
    const organisations = [{ ...row, ...review, topics: ["security", "agents"] }];
    const before = await backend.run((ctx) => ctx.db.get(id));
    expect(await backend.mutation(classify, { apply: false, organisations })).toEqual({
        applied: false,
        updated: 1,
        unchanged: 0,
    });
    expect(await backend.run((ctx) => ctx.db.get(id))).toEqual(before);
    expect(await backend.mutation(classify, { apply: true, organisations })).toEqual({
        applied: true,
        updated: 1,
        unchanged: 0,
    });
    const saved = (await backend.run((ctx) => ctx.db.get(id)))!;
    expect(saved).toEqual({
        ...before!,
        topics: ["security", "agents"],
        updatedAt: saved.updatedAt,
    });
    expect(
        await backend.mutation(classify, {
            apply: true,
            organisations: [{ ...row, ...review, topics: ["agents", "security"] }],
        }),
    ).toEqual({ applied: true, updated: 0, unchanged: 1 });
    expect(await backend.run((ctx) => ctx.db.get(id))).toEqual(saved);
});

test("test_reject_classification_conflicts_stale_identities_and_duplicates_atomically", async () => {
    for (const invalid of [
        { name: "Changed" },
        { website: "https://second.example/changed" },
        { slug: "missing" },
        { topics: ["missing"] },
        { topics: [] },
        { topics: ["ai", "ai"] },
        { topics: ["robotics"] },
    ]) {
        const { backend, row } = await fixture();
        await backend.run((ctx) =>
            ctx.db.insert("organisations", {
                name: "Second",
                slug: "second",
                website: "https://second.example",
                kind: "company",
                description: "Software",
                location: "Zurich",
                topics: ["security"],
                updatedAt: 1,
            }),
        );
        const before = await backend.run((ctx) => ctx.db.query("organisations").collect());
        const message =
            invalid.topics !== undefined
                ? !invalid.topics.length
                    ? "Existing topics differ: second."
                    : invalid.topics.length > 1
                      ? "Choose at most 12 distinct topics."
                      : invalid.topics[0] === "missing"
                        ? "Choose an available topic: missing."
                        : "Existing topics differ: second."
                : `Organisation identity changed: ${"slug" in invalid ? "missing" : "second"}.`;
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(classify, {
                    apply: isApply,
                    organisations: [
                        { ...row, ...review, topics: ["ai"] },
                        {
                            ...review,
                            name: "Second",
                            slug: "second",
                            website: "https://second.example",
                            topics: ["security"],
                            ...invalid,
                        },
                    ],
                }),
            ).rejects.toThrow(message);
            expect(await backend.run((ctx) => ctx.db.query("organisations").collect())).toEqual(
                before,
            );
            await expect(
                backend.mutation(classify, {
                    apply: isApply,
                    organisations: [
                        { ...row, ...review, topics: ["ai"] },
                        { ...row, ...review, topics: ["ai"] },
                    ],
                }),
            ).rejects.toThrow("Repeated organisation: example.");
            expect(await backend.run((ctx) => ctx.db.query("organisations").collect())).toEqual(
                before,
            );
        }
    }
});

test("test_bound_classification_batches", async () => {
    const { backend, row } = await fixture();
    for (const count of [0, 101]) {
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(classify, {
                    apply: isApply,
                    organisations: Array.from({ length: count }, () => ({
                        ...row,
                        ...review,
                        topics: ["ai"],
                    })),
                }),
            ).rejects.toThrow("Classify between 1 and 100 reviewed organisations.");
        }
    }
});

test("test_correct_kinds_and_allow_broad_investors_without_topics", async () => {
    const { backend, row, id } = await fixture();
    const { name, ...identity } = row;
    const organisations = [{ ...identity, ...review, kind: "investor", topics: [] }];
    const before = await backend.run((ctx) => ctx.db.get(id));
    expect(await backend.mutation(classify, { apply: false, organisations })).toEqual({
        applied: false,
        updated: 1,
        unchanged: 0,
    });
    expect(await backend.run((ctx) => ctx.db.get(id))).toEqual(before);
    expect(await backend.mutation(classify, { apply: true, organisations })).toEqual({
        applied: true,
        updated: 1,
        unchanged: 0,
    });
    const saved = (await backend.run((ctx) => ctx.db.get(id)))!;
    expect(saved).toEqual({ ...before!, kind: "investor", topics: [], updatedAt: saved.updatedAt });
    for (const isApply of [false, true]) {
        await expect(backend.mutation(classify, { apply: isApply, organisations })).rejects.toThrow(
            "Organisation kind changed: example.",
        );
    }
    expect(
        await backend.mutation(classify, {
            apply: true,
            organisations: [{ ...organisations[0], expectedKind: "investor" }],
        }),
    ).toEqual({ applied: true, updated: 0, unchanged: 1 });
});

test("test_require_exact_expected_topics_for_verified_corrections_and_clearing", async () => {
    const { backend, row, id } = await fixture();
    await backend.run((ctx) => ctx.db.patch(id, { topics: ["agents", "security"] }));
    const before = await backend.run((ctx) => ctx.db.get(id));
    for (const expectedTopics of [undefined, [], ["security"], ["agents", "agents"]]) {
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(classify, {
                    apply: isApply,
                    organisations: [
                        {
                            ...row,
                            ...review,
                            kind: "investor",
                            topics: [],
                            ...(expectedTopics === undefined ? {} : { expectedTopics }),
                        },
                    ],
                }),
            ).rejects.toThrow(
                expectedTopics === undefined
                    ? "Existing topics differ: example."
                    : "Organisation topics changed: example.",
            );
            expect(await backend.run((ctx) => ctx.db.get(id))).toEqual(before);
        }
    }
    const organisations = [
        { ...row, ...review, kind: "investor", topics: [], expectedTopics: ["security", "agents"] },
    ];
    expect(await backend.mutation(classify, { apply: false, organisations })).toEqual({
        applied: false,
        updated: 1,
        unchanged: 0,
    });
    expect(await backend.run((ctx) => ctx.db.get(id))).toEqual(before);
    await backend.mutation(classify, { apply: true, organisations });
    const saved = (await backend.run((ctx) => ctx.db.get(id)))!;
    expect(saved).toEqual({ ...before!, kind: "investor", topics: [], updatedAt: saved.updatedAt });
});

test("test_reject_redundant_classifications_and_missing_evidence_atomically", async () => {
    for (const invalid of [
        { topics: ["ai", "agents"], message: "Choose specific topics without ancestors: ai." },
        { expectedKind: "investor", message: "Organisation kind changed: second." },
        { reason: " ", message: "Classification evidence is required: second." },
        { sources: [], message: "Classification evidence is required: second." },
        { sources: ["invalid"], message: "Enter a valid HTTP or HTTPS URL." },
    ]) {
        const { backend, row } = await fixture();
        await backend.run((ctx) =>
            ctx.db.insert("organisations", {
                ...row,
                name: "Second",
                slug: "second",
                website: "https://second.example",
                kind: "company",
                description: "Software",
                location: "Zurich",
                updatedAt: 1,
            }),
        );
        const before = await backend.run((ctx) => ctx.db.query("organisations").collect());
        const { message, ...fields } = invalid;
        for (const isApply of [false, true]) {
            await expect(
                backend.mutation(classify, {
                    apply: isApply,
                    organisations: [
                        { ...row, ...review, kind: "investor", topics: [] },
                        {
                            ...row,
                            ...review,
                            name: "Second",
                            slug: "second",
                            website: "https://second.example",
                            topics: ["agents"],
                            ...fields,
                        },
                    ],
                }),
            ).rejects.toThrow(message);
            expect(await backend.run((ctx) => ctx.db.query("organisations").collect())).toEqual(
                before,
            );
        }
    }
});

/** Create the approved catalogue, an authorised editor and an unclassified legacy organisation. */
async function fixture() {
    const backend = convexTest(schema, modules);
    await backend.mutation(install, { apply: true });
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
