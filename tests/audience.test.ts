import { expect, test } from "bun:test";
import { convexTest, schema, modules, member } from "./backend";
import { api } from "../convex/_generated/api";
import { surveyQuestions } from "../convex/members/demographics";
import type { Doc } from "../convex/_generated/dataModel";
import { date } from "../convex/statistics/history";

test("test_accumulate_currently_active_signups_by_zurich_day", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Admin",
            searchText: "admin",
            visibility: "private",
        });
        for (const [authId, createdAt, status] of [
            ["admin", Date.parse("2026-01-01T12:00:00Z"), "active"],
            ["second", Date.parse("2026-01-01T23:30:00Z"), "active"],
            ["third", Date.parse("2026-01-02T12:00:00Z"), "active"],
            ["disabled", Date.parse("2026-01-03T12:00:00Z"), "disabled"],
        ] as const) {
            await ctx.db.insert("accounts", {
                authId,
                memberId,
                createdAt,
                updatedAt: createdAt,
                status,
                isAdmin: authId === "admin",
                isTeam: false,
            });
        }
    });
    const report = await backend
        .withIdentity({ subject: "admin" })
        .query(api.members.audience.report, {});
    expect(report.signupHistory).toEqual([
        { date: "2026-01-01", value: 1 },
        { date: "2026-01-02", value: 3 },
        { date: date(Date.now()), value: 3 },
    ]);
    expect(report.total).toBe(3);
});

test("test_restrict_empty_audience_report_to_active_administrators", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        for (const authId of ["admin", "team", "disabled"]) {
            const memberId = await member(ctx, {
                name: authId,
                searchText: authId,
                visibility: "private",
            });
            await ctx.db.insert("accounts", {
                authId,
                memberId,
                isAdmin: authId !== "team",
                isTeam: true,
                status: authId === "disabled" ? "disabled" : "active",
                createdAt: 1,
                updatedAt: 1,
            });
        }
    });
    await expect(backend.query(api.members.audience.report, {})).rejects.toThrow(
        "Sign in required.",
    );
    await expect(
        backend.withIdentity({ subject: "team" }).query(api.members.audience.report, {}),
    ).rejects.toThrow("Admin access is required.");
    await expect(
        backend.withIdentity({ subject: "disabled" }).query(api.members.audience.report, {}),
    ).rejects.toThrow("An active account is required.");
    const report = await backend
        .withIdentity({ subject: "admin" })
        .query(api.members.audience.report, {});
    // preserve the array response used by admin tabs opened before deployment
    const questions = await backend
        .withIdentity({ subject: "admin" })
        .query(api.members.audience.summary, {});
    expect(questions).toEqual(report.questions);

    expect({ ...report, questions: undefined }).toEqual({
        total: 2,
        signupHistory: [
            { date: "1970-01-01", value: 2 },
            { date: date(Date.now()), value: 2 },
        ],
        respondents: 0,
        finished: 0,
        fullyAnswered: 0,
        questions: undefined,
    });
    expect(report.questions.map((question) => question.field)).toEqual([...surveyQuestions]);
    expect(
        report.questions.every(
            (question) =>
                question.total === 2 &&
                question.responses === 0 &&
                question.withheld === 0 &&
                question.groups.every((group) => group.count === 0 && group.percentage === 0),
        ),
    ).toBe(true);
});

test("test_report_all_questions_with_distinct_completion_and_response_denominators", async () => {
    // finishing with skips is distinct from answering all current questions
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const accounts: Partial<Doc<"accounts">>[] = [
            { authId: "admin", isAdmin: true },
            {
                authId: "complete",
                surveyCompletedAt: 20,
                interests: ["archived", "removed"],
                participation: ["attend", "speak"],
                motivations: ["learning", "friends"],
                demographics: {
                    eventKinds: ["talks", "workshops"],
                    discovery: "friend",
                    eventFrequency: "monthly",
                    eventsAttended: "0",
                    roles: ["engineering"],
                    experience: "none",
                    education: "none",
                    age: "25–34",
                    residence: "CH",
                    citizenships: ["CH", "DE"],
                    languages: ["en", "el"],
                },
            },
            { authId: "partial", motivations: ["learning"] },
            {
                authId: "skipped",
                surveyCompletedAt: 30,
                surveyVisited: [...surveyQuestions],
                demographics: { age: null },
            },
            { authId: "legacy", onboardedAt: 10, demographics: { eventsPerYear: "25+" } },
            {
                authId: "inactive",
                status: "disabled",
                surveyCompletedAt: 40,
                motivations: ["sharing"],
            },
        ];
        for (const account of accounts) {
            const memberId = await member(ctx, {
                name: account.authId!,
                searchText: account.authId!,
                visibility: "private",
            });
            await ctx.db.insert("accounts", {
                authId: account.authId!,
                memberId,
                status: "active",
                isAdmin: false,
                isTeam: false,
                createdAt: 1,
                updatedAt: 1,
                ...account,
            });
        }
        for (const [slug, isActive] of [
            ["active", true],
            ["archived", false],
        ] as const)
            await ctx.db.insert("topics", { slug, name: `${slug} subject`, isActive });
    });

    // compare current questions and completion counts without leaking private account fields
    const report = await backend
        .withIdentity({ subject: "admin" })
        .query(api.members.audience.report, {});
    expect(Object.keys(report).sort()).toEqual([
        "finished",
        "fullyAnswered",
        "questions",
        "respondents",
        "signupHistory",
        "total",
    ]);
    expect({ ...report, questions: undefined }).toEqual({
        total: 5,
        signupHistory: [
            { date: "1970-01-01", value: 5 },
            { date: date(Date.now()), value: 5 },
        ],
        respondents: 2,
        finished: 2,
        fullyAnswered: 1,
        questions: undefined,
    });
    expect(report.questions.map((row) => row.field)).toEqual([...surveyQuestions]);
    expect(report.questions.every((row) => row.total === 5)).toBe(true);
    expect(report.questions.map((row) => [row.field, row.responses, row.withheld])).toEqual([
        ["interests", 1, 0],
        ["eventKinds", 1, 0],
        ["eventFrequency", 1, 0],
        ["motivations", 2, 0],
        ["participation", 1, 0],
        ["eventsAttended", 1, 0],
        ["discovery", 1, 0],
        ["roles", 1, 0],
        ["experience", 1, 0],
        ["education", 1, 0],
        ["residence", 1, 0],
        ["languages", 1, 0],
        ["age", 1, 1],
        ["citizenships", 1, 0],
    ]);
    expect(
        report.questions
            .find((row) => row.field === "motivations")!
            .groups.filter((row) => row.count),
    ).toEqual([
        { label: "Meeting friends", count: 1, percentage: 50 },
        { label: "Learning something", count: 2, percentage: 100 },
    ]);
    expect(report.questions.find((row) => row.field === "interests")!.groups).toEqual([
        { label: "active subject", count: 0, percentage: 0 },
        { label: "archived subject", count: 1, percentage: 100 },
        { label: "removed", count: 1, percentage: 100 },
    ]);

    // retain zero country choices for the UI toggle, and reported less-common languages
    expect(
        report.questions
            .find((row) => row.field === "residence")!
            .groups.some((row) => row.count === 0),
    ).toBe(true);
    expect(
        report.questions
            .find((row) => row.field === "languages")!
            .groups.filter((row) => row.count),
    ).toHaveLength(2);
    await expect(
        backend.withIdentity({ subject: "partial" }).query(api.members.audience.report, {}),
    ).rejects.toThrow("Admin access is required.");

    // editing every answer does not imply that the optional survey was explicitly finished
    await backend.run(async (ctx) => {
        const account = await ctx.db
            .query("accounts")
            .withIndex("by_auth", (query) => query.eq("authId", "complete"))
            .unique();
        await ctx.db.patch(account!._id, { surveyCompletedAt: undefined });
    });
    const unfinished = await backend
        .withIdentity({ subject: "admin" })
        .query(api.members.audience.report, {});
    expect({
        finished: unfinished.finished,
        fullyAnswered: unfinished.fullyAnswered,
        respondents: unfinished.respondents,
    }).toEqual({ finished: 1, fullyAnswered: 1, respondents: 2 });
});
