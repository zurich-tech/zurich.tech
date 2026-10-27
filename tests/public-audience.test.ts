import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";
import { surveyQuestions } from "../convex/members/demographics";
import { surveyTitles } from "../convex/members/demographics";

test("test_regional_results_filter_residence_and_recalculate_option_coverage", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Respondent",
            searchText: "",
            visibility: "private",
        });
        for (const [index, residence] of [
            "CH",
            "DE",
            "FR",
            "IT",
            "AT",
            "LI",
            "IN",
            undefined,
        ].entries()) {
            await ctx.db.insert("accounts", {
                memberId,
                authId: String(index),
                status: "active",
                isAdmin: false,
                isTeam: false,
                createdAt: 1,
                updatedAt: 1,
                demographics: { residence, citizenships: ["IN"] },
                participation: index === 0 ? ["demo"] : ["attend"],
                surveyReviews: [
                    {
                        question: "participation",
                        options: index < 2 || index >= 6 ? ["demo", "attend"] : ["attend"],
                        source: "explicit",
                        at: 1,
                        wording: "How would you like to get involved?",
                    },
                ],
            });
        }
    });

    const regional = await backend.query(api.statistics.audience.community, {});
    expect(
        regional
            .find((question) => question.field === "residence")!
            .groups.filter((group) => group.hasResponses)
            .map((group) => group.label)
            .sort(),
    ).toEqual(["Austria", "France", "Germany", "Italy", "Liechtenstein", "Switzerland"]);
    expect(
        regional
            .find((question) => question.field === "participation")!
            .groups.find((group) => group.label === "Demo"),
    ).toEqual({
        label: "Demo",
        percentage: 50,
        hasResponses: true,
        hasUnreviewed: true,
        isEstimated: false,
    });
});

test("test_public_results_publish_only_percentages_and_preserve_option_coverage", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Private person",
            searchText: "private",
            visibility: "private",
        });
        for (const [authId, status, options, answer] of [
            ["old", "active", ["attend"], ["attend"]],
            ["new", "active", ["attend", "demo"], ["demo"]],
            ["disabled", "disabled", ["attend", "demo"], ["attend"]],
        ] as const) {
            await ctx.db.insert("accounts", {
                memberId,
                authId,
                status,
                isAdmin: false,
                isTeam: false,
                createdAt: 1,
                updatedAt: 1,
                participation: [...answer],
                demographics: { residence: "CH" },
                surveyReviews: [
                    {
                        question: "participation",
                        options: [...options],
                        source: "explicit",
                        at: 1,
                        wording: "How would you like to get involved?",
                    },
                ],
            });
        }
    });

    const report = await backend.query(api.statistics.audience.community, {});
    expect(report).toHaveLength(surveyQuestions.length);
    const participation = report.find((question) => question.field === "participation")!;
    expect(participation.label).toBe("Involvement");
    expect(participation.groups.find((group) => group.label === "Demo")).toEqual({
        label: "Demo",
        percentage: 100,
        hasResponses: true,
        hasUnreviewed: true,
        isEstimated: false,
    });
    expect(participation.groups.find((group) => group.label === "Attend")?.percentage).toBe(50);
    for (const question of report) {
        expect(Object.keys(question).sort()).toEqual(["field", "groups", "label"]);
        for (const group of question.groups)
            expect(Object.keys(group).sort()).toEqual([
                "hasResponses",
                "hasUnreviewed",
                "isEstimated",
                "label",
                "percentage",
            ]);
    }
});

test("test_empty_public_results_have_consistent_headings_and_no_fabricated_responses", async () => {
    const backend = convexTest(schema, modules);
    const report = await backend.query(api.statistics.audience.community, {});
    expect(Object.keys(surveyTitles).sort()).toEqual([...surveyQuestions].sort());
    expect(
        report.every((question) =>
            question.groups.every((group) => !group.hasResponses && group.percentage === 0),
        ),
    ).toBe(true);
});
