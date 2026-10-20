import { convexTest, schema, modules, member } from "./backend";
import { expect, test } from "bun:test";
import { api } from "../convex/_generated/api";
import type { FunctionArgs } from "convex/server";
import { demographicOptions, surveyQuestions } from "../convex/members/demographics";

/** Create a signed-in member with no public address. */
async function setup(backend = convexTest(schema, modules)) {
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Test member",
            searchText: "test member",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            authId: "member",
            memberId,
            status: "active",
            isTeam: false,
            isAdmin: false,
            createdAt: 1,
            updatedAt: 1,
        });
    });

    return backend.withIdentity({ subject: "member" });
}

test("test_save_and_skip_individual_questions_without_erasing_answers", async () => {
    const client = await setup();
    const original = {
        demographics: {
            languages: ["en", "de"],
            eventsPerYear: "10-12" as const,
            eventFrequency: "monthly" as const,
        },
        interests: [],
        motivations: ["learning"],
        participation: ["attend"],
    };
    await client.mutation(api.members.audience.save, original);
    const before = await client.query(api.members.profiles.current, {});

    // update one scalar, then skip it without changing its saved value
    await client.mutation(api.members.audience.answer, {
        question: "eventFrequency",
        values: ["weekly"],
    });
    await client.mutation(api.members.audience.answer, { question: "eventFrequency" });
    await client.mutation(api.members.audience.answer, { question: "age" });
    expect(await client.query(api.members.audience.current, {})).toEqual({
        ...original,
        demographics: { ...original.demographics, eventFrequency: "weekly" },
        onboardedAt: undefined,
        surveyCompletedAt: undefined,
        surveyVisited: ["eventFrequency", "age"],
        surveyReviews: [],
    });
    expect(await client.query(api.members.profiles.current, {})).toEqual({
        ...before,
        demographics: { ...original.demographics, eventFrequency: "weekly" },
    });

    // explicit empty answers clear only the selected question
    await client.mutation(api.members.audience.answer, { question: "eventFrequency", values: [] });
    await client.mutation(api.members.audience.answer, { question: "languages", values: [] });
    expect((await client.query(api.members.audience.current, {})).demographics).toEqual({
        eventsPerYear: "10-12",
        eventFrequency: null,
        languages: [],
    });
});

test("test_reject_invalid_guided_answers_without_advancing_progress", async () => {
    const client = await setup();
    const before = await client.query(api.members.audience.current, {});
    for (const [question, values, message] of [
        ["eventFrequency", ["daily"], "Choose an answer from the available options."],
        ["age", ["18–24", "25–34"], "Choose only one answer."],
        ["residence", ["invalid"], "Choose your country of residence from the list."],
        ["languages", ["en", "en"], "Choose each language once from the available options."],
        [
            "participation",
            ["invalid"],
            "Choose each way to participate once from the available options.",
        ],
    ] as const) {
        await expect(
            client.mutation(api.members.audience.answer, { question, values: [...values] }),
        ).rejects.toMatchObject({ data: message });
    }
    expect(await client.query(api.members.audience.current, {})).toEqual(before);
});

test("test_finish_guided_survey_without_requiring_or_clearing_answers", async () => {
    const client = await setup();
    await client.mutation(api.members.audience.answer, {
        question: "eventsAttended",
        values: ["0"],
    });
    await client.mutation(api.members.audience.skip, {});
    const current = await client.query(api.members.audience.current, {});
    expect(current).toEqual({
        demographics: { eventsAttended: "0" },
        interests: [],
        motivations: [],
        participation: [],
        surveyVisited: ["eventsAttended"],
        onboardedAt: expect.any(Number),
        surveyCompletedAt: undefined,
        surveyReviews: [],
    });
});

test("test_import_drafts_atomically_and_preserve_skipped_account_answers", async () => {
    const client = await setup();
    await client.mutation(api.members.audience.answer, { question: "residence", values: ["CH"] });
    const before = await client.query(api.members.audience.current, {});
    await expect(
        client.mutation(api.members.audience.saveDraft, {
            answers: [
                { question: "languages", values: ["el", "sq"] },
                { question: "citizenships", values: ["XX"] },
            ],
        }),
    ).rejects.toMatchObject({ data: "Choose each country of citizenship once from the list." });
    expect(await client.query(api.members.audience.current, {})).toEqual(before);

    await client.mutation(api.members.audience.saveDraft, {
        answers: [
            { question: "residence" },
            { question: "languages", values: ["el", "sq"] },
            { question: "citizenships", values: ["CH", "GB"] },
        ],
    });
    expect((await client.query(api.members.audience.current, {})).demographics).toEqual({
        residence: "CH",
        languages: ["el", "sq"],
        citizenships: ["CH", "GB"],
    });
    await client.mutation(api.members.audience.finish, {});
    expect((await client.query(api.members.audience.current, {})).surveyCompletedAt).toEqual(
        expect.any(Number),
    );
});

test("test_roundtrip_extended_languages_in_both_editors", async () => {
    const client = await setup();
    await client.mutation(api.members.audience.answer, {
        question: "languages",
        values: ["en", "el", "sq"],
    });
    const profile = await client.query(api.members.profiles.current, {});
    expect(profile.demographics.languages).toEqual(["en", "el", "sq"]);
    await client.mutation(api.members.profiles.save, {
        name: "Test member",
        isPublic: false,
        demographics: profile.demographics,
    });
    expect((await client.query(api.members.audience.current, {})).demographics.languages).toEqual([
        "en",
        "el",
        "sq",
    ]);
});

test("test_isolate_survey_answers_and_completion_between_accounts", async () => {
    const backend = convexTest(schema, modules);
    const client = await setup(backend);
    await client.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Second member",
            searchText: "second member",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            authId: "second",
            memberId,
            status: "active",
            isTeam: false,
            isAdmin: false,
            createdAt: 1,
            updatedAt: 1,
        });
    });
    const second = backend.withIdentity({ subject: "second" });
    const before = await second.query(api.members.audience.current, {});
    await client.mutation(api.members.audience.saveDraft, {
        answers: [{ question: "languages", values: ["en", "el"] }],
    });
    await client.mutation(api.members.audience.finish, {});
    expect(await second.query(api.members.audience.current, {})).toEqual(before);

    // finishing does not prevent later edits or erase completion when one answer changes
    const finished = await client.query(api.members.audience.current, {});
    await client.mutation(api.members.audience.answer, { question: "languages", values: ["de"] });
    expect(await client.query(api.members.audience.current, {})).toEqual({
        ...finished,
        demographics: { languages: ["de"] },
    });
});

test("test_exclude_retired_questions_from_audience_reports", async () => {
    const backend = convexTest(schema, modules);
    await backend.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Admin",
            searchText: "admin",
            visibility: "private",
        });
        await ctx.db.insert("accounts", {
            authId: "admin",
            memberId,
            status: "active",
            isTeam: true,
            isAdmin: true,
            createdAt: 1,
            updatedAt: 1,
            demographics: { eventsPerYear: "10-12", eventFrequency: "monthly" },
        });
    });

    // report only current questions even when an account retains an annual answer
    const client = backend.withIdentity({ subject: "admin" });
    const report = await client.query(api.members.audience.report, {});
    expect(report.questions.map((question) => question.field)).toEqual([...surveyQuestions]);
    expect({ ...report, questions: undefined, signupHistory: undefined }).toEqual({
        total: 1,
        respondents: 1,
        finished: 0,
        fullyAnswered: 0,
        questions: undefined,
        signupHistory: undefined,
    });
});

test("test_roundtrip_optional_event_attendance_answers", async () => {
    const client = await setup();
    const before = await client.query(api.members.profiles.current, {});
    expect(before.demographics).toEqual({});

    // preserve every agreed attendance and frequency choice through both survey entry points
    for (let index = 0; index < 8; index++) {
        const demographics = {
            eventsAttended: demographicOptions.eventsAttended[index].value,
            eventFrequency: demographicOptions.eventFrequency[index].value,
        };
        await client.mutation(api.members.profiles.save, {
            name: "Test member",
            isPublic: false,
            demographics,
        });
        expect((await client.query(api.members.audience.current, {})).demographics).toEqual(
            demographics,
        );
        await client.mutation(api.members.audience.save, {
            demographics,
            interests: [],
            motivations: [],
            participation: [],
        });
        expect((await client.query(api.members.profiles.current, {})).demographics).toEqual(
            demographics,
        );
    }

    // distinguish an explicit zero from clearing an optional answer
    await client.mutation(api.members.profiles.save, {
        name: "Test member",
        isPublic: false,
        demographics: {},
    });
    expect((await client.query(api.members.audience.current, {})).demographics).toEqual({});
});

test("test_preserve_annual_answers_separately_from_event_frequency", async () => {
    const client = await setup();

    // retain each original annual range without selecting a new frequency on its behalf
    for (const option of demographicOptions.eventsPerYear) {
        const previous = { eventsPerYear: option.value };
        await client.mutation(api.members.profiles.save, {
            name: "Test member",
            isPublic: false,
            demographics: previous,
        });
        expect((await client.query(api.members.audience.current, {})).demographics).toEqual(
            previous,
        );

        // save and clear a new answer without losing or converting the original response
        for (const demographics of [
            { ...previous, eventFrequency: "several-weekly" as const },
            { ...previous, eventFrequency: "unsure" as const },
            previous,
        ]) {
            await client.mutation(api.members.audience.save, {
                demographics,
                interests: [],
                motivations: [],
                participation: [],
            });
            expect((await client.query(api.members.profiles.current, {})).demographics).toEqual(
                demographics,
            );
        }
    }
});

test("test_save_private_and_public_profiles_without_a_custom_address", async () => {
    const client = await setup();
    const answers = { languages: ["en", "de", "ru"] };
    const before = await client.query(api.members.profiles.current, {});

    // accept private survey answers without requiring a public address
    await client.mutation(api.members.profiles.save, {
        name: "Test member",
        isPublic: false,
        demographics: answers,
    });
    expect(await client.query(api.members.profiles.current, {})).toEqual({
        ...before,
        demographics: answers,
    });

    // allocate an address when publishing, without requiring a custom choice
    await client.mutation(api.members.profiles.save, {
        name: "Test member",
        isPublic: true,
    });
    expect(await client.query(api.members.profiles.current, {})).toEqual({
        ...before,
        demographics: answers,
        handle: "test-member",
        visibility: "public",
    });
});

test("test_preserve_existing_addresses_when_left_blank_or_changing_visibility", async () => {
    const client = await setup();
    await client.mutation(api.members.profiles.save, {
        name: "Test member",
        isPublic: true,
        handle: "Custom-address",
    });
    const before = await client.query(api.members.profiles.current, {});

    // neither clearing the optional field nor editing the name breaks existing links
    for (const isPublic of [false, true]) {
        await client.mutation(api.members.profiles.save, {
            name: "Updated member",
            isPublic,
            handle: " ",
        });
        expect(await client.query(api.members.profiles.current, {})).toEqual({
            ...before,
            name: "Updated member",
            visibility: isPublic ? "public" : "private",
        });
    }
});

test("test_generate_unique_addresses_without_claiming_active_or_reserved_names", async () => {
    const client = await setup();
    await client.run(async (ctx) => {
        const memberId = await member(ctx, {
            name: "Other member",
            searchText: "other member",
            visibility: "private",
        });
        for (const [name, status] of [
            ["test-member", "active"],
            ["test-member-2", "reserved"],
            ["test-member-3", "released"],
        ] as const) {
            await ctx.db.insert("handles", { name, status, memberId, createdAt: 1, updatedAt: 1 });
        }
    });
    await expect(
        client.mutation(api.members.profiles.save, {
            name: "Test member",
            isPublic: true,
            handle: "test-member",
        }),
    ).rejects.toMatchObject({ data: "This profile address is already taken." });
    await client.mutation(api.members.profiles.save, { name: "Test member", isPublic: true });
    expect((await client.query(api.members.profiles.current, {})).handle).toBe("test-member-3");
});

test("test_generate_valid_addresses_for_accented_short_and_non_latin_names", async () => {
    for (const [name, handle] of [
        ["Florian Cäsar", "florian-casar"],
        ["Li", "member"],
        ["张伟", "member"],
        ["A".repeat(120), "a".repeat(30)],
    ]) {
        const client = await setup();
        await client.mutation(api.members.profiles.save, { name, isPublic: true });
        expect((await client.query(api.members.profiles.current, {})).handle).toBe(handle);
    }
});

test("test_expose_actionable_profile_validation_messages", async () => {
    const client = await setup();
    for (const [fields, message] of [
        [{ handle: "12" }, "Use 3–40 letters, numbers or hyphens, starting with a letter."],
        [{ name: "" }, "Enter a name, up to 120 characters."],
        [{ profileUrl: "not a url" }, "Enter a valid HTTP or HTTPS URL."],
        [
            { demographics: { languages: ["en", "en"] } },
            "Choose each language once from the available options.",
        ],
        [{ affiliations: [{ role: "", organisation: "" }] }, "Enter a role or organisation."],
    ] satisfies [Partial<FunctionArgs<typeof api.members.profiles.save>>, string][]) {
        await expect(
            client.mutation(api.members.profiles.save, {
                name: "Test member",
                isPublic: false,
                ...fields,
            }),
        ).rejects.toMatchObject({ data: message });
    }
});
