import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api, internal } from "../convex/_generated/api";
import { inferReviews, needsReview, reviewOptions, saveReviews } from "../convex/members/reviews";
import { surveyLabels } from "../convex/members/demographics";

test("historical coverage uses completion time and retains actual selections", () => {
    const reviews = inferReviews({
        motivations: ["learning", "hiring"],
        surveyCompletedAt: Date.parse("2026-10-19T10:00:00Z"),
        updatedAt: Date.parse("2026-10-20T12:00:00Z"),
    });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].source).toBe("inferred");
    expect(reviews[0].at).toBeUndefined();
    expect(reviews[0].options).toContain("hiring");
    expect(reviews[0].options).not.toContain("customers");
});

test("later historical responses include options deployed before their estimated answer time", () => {
    const reviews = inferReviews({
        motivations: ["learning"],
        updatedAt: Date.parse("2026-10-20T12:00:00Z"),
    });
    expect(reviews[0].options).toEqual(reviewOptions("motivations"));
    expect(inferReviews({})).toEqual([]);
});

test("saving unchanged choices clears updates but an older snapshot does not certify new options", () => {
    const previous = inferReviews({ motivations: ["learning"] });
    const current = {
        question: "motivations" as const,
        wording: surveyLabels.motivations,
        options: reviewOptions("motivations"),
    };
    expect(needsReview(previous[0], current)).toBe(true);
    const saved = saveReviews(previous, [current], 100);
    expect(needsReview(saved[0], current)).toBe(false);
    expect(saved[0]).toMatchObject({ source: "explicit", at: 100 });
    expect(
        needsReview(
            saveReviews(previous, [{ ...current, options: ["learning"] }], 200)[0],
            current,
        ),
    ).toBe(true);
});

test("backfill is complete, idempotent and changes only review metadata", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Survey member",
            searchText: "survey member",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            memberId,
            authId: "survey",
            status: "active",
            isTeam: false,
            isAdmin: true,
            createdAt: 1,
            updatedAt: 2,
            surveyCompletedAt: 3,
            surveyVisited: ["motivations"],
            motivations: ["learning"],
        });
    });
    const before = await backend.run((ctx) => ctx.db.query("accounts").collect());
    expect(await backend.action(internal.members.backfill.run, { dryRun: true })).toEqual({
        scanned: 1,
        changed: 1,
        questions: 1,
        completed: 1,
    });
    expect(await backend.run((ctx) => ctx.db.query("accounts").collect())).toEqual(before);
    expect(await backend.action(internal.members.backfill.run, { dryRun: false })).toEqual({
        scanned: 1,
        changed: 1,
        questions: 1,
        completed: 1,
    });
    const after = await backend.run((ctx) => ctx.db.query("accounts").collect());
    const { surveyReviews, ...unchanged } = after[0];
    expect(unchanged).toEqual(before[0]);
    expect(surveyReviews?.[0].source).toBe("inferred");
    expect((await backend.action(internal.members.backfill.run, { dryRun: false })).changed).toBe(
        0,
    );

    const client = backend.withIdentity({ subject: "survey" });
    const review = {
        question: "motivations" as const,
        wording: surveyLabels.motivations,
        options: reviewOptions("motivations"),
    };
    await client.mutation(api.members.audience.saveDraft, {
        answers: [{ question: "motivations", values: ["learning"], review }],
    });
    const current = await client.query(api.members.audience.current, {});
    expect(current.surveyCompletedAt).toBe(3);
    expect(current.motivations).toEqual(["learning"]);
    expect(current.surveyReviews[0].source).toBe("explicit");
    const report = await client.query(api.members.audience.report, {});
    const chart = report.questions.find((question) => question.field === "motivations")!;
    expect(chart.groups.find((group) => group.label === "Hiring people")).toMatchObject({
        reviewed: 1,
        unreviewed: 0,
        count: 0,
    });
});

test("coverage excludes earlier respondents from newly introduced choice denominators", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        for (const [index, motivations] of [
            ["old", ["learning"]],
            ["new", ["hiring"]],
        ] as const) {
            const memberId = await member(ctx, {
                name: index,
                searchText: index,
                visibility: "private",
            });
            await ctx.db.insert("accounts", {
                memberId,
                authId: index,
                status: "active",
                isTeam: false,
                isAdmin: true,
                createdAt: 1,
                updatedAt: 2,
                motivations: [...motivations],
            });
        }
    });
    const report = await backend
        .withIdentity({ subject: "old" })
        .query(api.members.audience.report, {});
    const chart = report.questions.find((question) => question.field === "motivations")!;
    expect(chart.responses).toBe(2);
    expect(chart.groups.find((group) => group.label === "Hiring people")).toMatchObject({
        count: 1,
        reviewed: 1,
        unreviewed: 1,
        inferred: 2,
        percentage: 100,
    });
    expect(chart.groups.find((group) => group.label === "Finding customers")).toMatchObject({
        count: 0,
        reviewed: 0,
        unreviewed: 2,
        percentage: 0,
    });
});
