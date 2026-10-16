import { expect, test } from "bun:test";
import { makeFunctionReference } from "convex/server";
import { api } from "../convex/_generated/api";
import { retiredInterests } from "../convex/members/interests";
import { validateTopics } from "../convex/topics/queries";
import { interestGroups } from "../src/topics/groups";
import { catalogue } from "../convex/topics/catalogue";
import { convexTest, schema, modules, member } from "./backend";

/** Install only Games without reconciling unrelated catalogue entries. */
const installGames = makeFunctionReference<"mutation">("topics/imports:installGames");

test("test_offer_games_separately_and_retire_data_only_in_interests", () => {
    const choices = interestGroups.flatMap((group) => group.topics);
    expect(
        choices.filter((slug) => ["games", "graphics", "data-engineering"].includes(slug)),
    ).toEqual(["games", "graphics"]);
    expect(retiredInterests).toEqual({ "data-engineering": "Data (retired)" });
});

test("test_offer_specific_interests_from_the_existing_catalogue_without_duplicates", () => {
    const choices = interestGroups.flatMap((group) => group.topics);
    const additions = ["space", "quantum", "materials", "manufacturing", "databases", "analytics"];
    expect(additions.map((slug) => choices.includes(slug))).toEqual(additions.map(() => true));
    expect(new Set(choices).size).toBe(choices.length);
    expect(choices.filter((slug) => !catalogue.some((topic) => topic.slug === slug))).toEqual([]);
});

test("test_hide_retired_interests_even_without_catalogue_records_and_preserve_responses", async () => {
    const { backend, client, accountId } = await fixture(["data-engineering"]);
    const before = await backend.run((ctx) => ctx.db.get(accountId));
    for (const removeCatalogue of [false, true]) {
        if (removeCatalogue) {
            await backend.run(async (ctx) => {
                const topic = await ctx.db
                    .query("topics")
                    .withIndex("by_slug", (query) => query.eq("slug", "data-engineering"))
                    .unique();
                await ctx.db.delete(topic!._id);
            });
        }
        const report = await client.query(api.members.audience.report, {});
        expect(report.questions.find((question) => question.field === "interests")).toEqual({
            field: "interests",
            label: "What are you interested in?",
            multiple: true,
            responses: 1,
            total: 1,
            withheld: 0,
            groups: [{ label: "Graphics", count: 0, percentage: 0 }],
        });
        expect(await backend.run((ctx) => ctx.db.get(accountId))).toEqual(before);
    }
});

test("test_preview_install_games_idempotently_without_changing_existing_records", async () => {
    const { backend, accountId } = await fixture(["data-engineering"]);
    const topics = await backend.run((ctx) => ctx.db.query("topics").collect());
    const account = await backend.run((ctx) => ctx.db.get(accountId));
    const organisationId = await backend.run((ctx) =>
        ctx.db.insert("organisations", {
            name: "Existing",
            slug: "existing",
            website: "https://example.org",
            kind: "company",
            description: "Existing",
            location: "Zurich",
            topics: ["data-engineering"],
            updatedAt: 1,
        }),
    );
    const organisation = await backend.run((ctx) => ctx.db.get(organisationId));
    expect(await backend.mutation(installGames, { apply: false })).toEqual({
        applied: false,
        created: 1,
        unchanged: 0,
    });
    expect(await backend.run((ctx) => ctx.db.query("topics").collect())).toEqual(topics);
    expect(await backend.mutation(installGames, { apply: true })).toEqual({
        applied: true,
        created: 1,
        unchanged: 0,
    });
    const installed = await backend.run((ctx) => ctx.db.query("topics").collect());
    expect(installed.filter((topic) => topic.slug !== "games")).toEqual(topics);
    expect(
        installed
            .filter((topic) => topic.slug === "games")
            .map(({ slug, name, isActive, parent }) => ({ slug, name, isActive, parent })),
    ).toEqual([{ slug: "games", name: "Games", isActive: true, parent: undefined }]);
    expect(await backend.mutation(installGames, { apply: true })).toEqual({
        applied: true,
        created: 0,
        unchanged: 1,
    });
    expect(await backend.run((ctx) => ctx.db.query("topics").collect())).toEqual(installed);
    expect(await backend.run((ctx) => ctx.db.get(accountId))).toEqual(account);
    expect(await backend.run((ctx) => ctx.db.get(organisationId))).toEqual(organisation);
});

test("test_refuse_games_conflicts_in_preview_and_apply_without_writes", async () => {
    for (const conflict of [
        { slug: "gaming", name: "Games", isActive: true },
        { slug: "games", name: "Gaming", isActive: true },
        { slug: "games", name: "Games", isActive: false },
        { slug: "games", name: "Games", isActive: true, parent: "graphics" },
    ]) {
        const { backend } = await fixture([]);
        await backend.run((ctx) => ctx.db.insert("topics", conflict));
        const before = await backend.run((ctx) => ctx.db.query("topics").collect());
        for (const apply of [false, true]) {
            await expect(backend.mutation(installGames, { apply })).rejects.toThrow(
                "Review the existing Games topic before installing.",
            );
            expect(await backend.run((ctx) => ctx.db.query("topics").collect())).toEqual(before);
        }
    }
});

test("test_reject_new_data_answers_on_every_member_write_path_and_allow_games", async () => {
    const { backend, client, accountId } = await fixture([]);
    await backend.mutation(installGames, { apply: true });
    const before = await backend.run((ctx) => ctx.db.get(accountId));
    for (const interests of [["data-engineering"], ["games", "data-engineering"]]) {
        await expect(
            client.mutation(api.members.audience.answer, {
                question: "interests",
                values: interests,
            }),
        ).rejects.toThrow("Choose an available interest: data-engineering.");
        await expect(
            client.mutation(api.members.audience.saveDraft, {
                answers: [{ question: "interests", values: interests }],
            }),
        ).rejects.toThrow("Choose an available interest: data-engineering.");
        await expect(
            client.mutation(api.members.audience.save, {
                demographics: {},
                participation: [],
                motivations: [],
                interests,
            }),
        ).rejects.toThrow("Choose an available interest: data-engineering.");
        await expect(
            client.mutation(api.members.profiles.save, {
                name: "Member",
                isPublic: false,
                interests,
            }),
        ).rejects.toThrow("Choose an available interest: data-engineering.");
    }
    expect(await backend.run((ctx) => ctx.db.get(accountId))).toEqual(before);
    await client.mutation(api.members.audience.saveDraft, {
        answers: [{ question: "interests", values: ["games", "graphics"] }],
    });
    expect((await client.query(api.members.audience.current, {})).interests).toEqual([
        "games",
        "graphics",
    ]);

    // Data remains assignable to shared content and organisations
    await backend.run((ctx) => validateTopics(ctx, ["data-engineering"]));
});

test("test_preserve_retired_answers_and_report_exact_counts_without_reclassification", async () => {
    const { backend, client } = await fixture(["data-engineering"]);
    await backend.mutation(installGames, { apply: true });
    await client.mutation(api.members.audience.answer, { question: "interests" });
    await client.mutation(api.members.audience.saveDraft, { answers: [{ question: "age" }] });
    expect((await client.query(api.members.audience.current, {})).interests).toEqual([
        "data-engineering",
    ]);
    await client.mutation(api.members.audience.save, {
        demographics: {},
        participation: [],
        motivations: [],
        interests: ["data-engineering", "games"],
    });
    await client.mutation(api.members.profiles.save, {
        name: "Member",
        isPublic: false,
        interests: ["data-engineering", "games"],
    });
    const report = await client.query(api.members.audience.report, {});
    expect(report.questions.find((question) => question.field === "interests")).toEqual({
        field: "interests",
        label: "What are you interested in?",
        multiple: true,
        responses: 1,
        total: 1,
        withheld: 0,
        groups: [
            { label: "Games", count: 1, percentage: 100 },
            { label: "Graphics", count: 0, percentage: 0 },
        ],
    });

    // only an explicit edit removes the old answer, after which it cannot be newly assigned
    await client.mutation(api.members.audience.answer, {
        question: "interests",
        values: ["games"],
    });
    await expect(
        client.mutation(api.members.audience.answer, {
            question: "interests",
            values: ["data-engineering"],
        }),
    ).rejects.toThrow("Choose an available interest: data-engineering.");
    expect((await client.query(api.members.audience.current, {})).interests).toEqual(["games"]);
});

/** Seed existing topic records and an authenticated administrator's private answers. */
async function fixture(interests: string[]) {
    const backend = convexTest(schema, modules);
    const accountId = await backend.run(async (ctx) => {
        for (const [slug, name] of [
            ["data-engineering", "Data"],
            ["graphics", "Graphics"],
        ])
            await ctx.db.insert("topics", { slug, name, isActive: true });
        const memberId = await member(ctx, {
            name: "Member",
            searchText: "member",
            visibility: "private",
        });

        return ctx.db.insert("accounts", {
            authId: "member",
            memberId,
            status: "active",
            isAdmin: true,
            isTeam: false,
            interests,
            createdAt: 1,
            updatedAt: 1,
        });
    });

    return { backend, accountId, client: backend.withIdentity({ subject: "member" }) };
}
