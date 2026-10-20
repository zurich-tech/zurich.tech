import { expect, test } from "bun:test";
import { api } from "../convex/_generated/api";
import { retiredInterests } from "../convex/members/interests";
import { validateTopics } from "../convex/topics/queries";
import { interestGroups } from "../convex/members/groups";
import { catalogue } from "../convex/topics/catalogue";
import { convexTest, schema, modules, member } from "./backend";

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
            groups: [
                {
                    label: "Graphics",
                    count: 0,
                    percentage: 0,
                    reviewed: 1,
                    inferred: 1,
                    unreviewed: 0,
                },
            ],
        });
        expect(await backend.run((ctx) => ctx.db.get(accountId))).toEqual(before);
    }
});

test("test_reject_new_data_answers_on_every_member_write_path_and_allow_games", async () => {
    const { backend, client, accountId } = await fixture([]);
    await backend.run((ctx) =>
        ctx.db.insert("topics", { slug: "games", name: "Games", isActive: true }),
    );
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
    await backend.run((ctx) =>
        ctx.db.insert("topics", { slug: "games", name: "Games", isActive: true }),
    );
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
            { label: "Games", count: 1, percentage: 100, reviewed: 1, inferred: 1, unreviewed: 0 },
            { label: "Graphics", count: 0, percentage: 0, reviewed: 1, inferred: 1, unreviewed: 0 },
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
