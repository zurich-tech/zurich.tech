import { expect, test } from "bun:test";
import {
    validateDemographics,
    validateMotivations,
    validateParticipation,
    participationOptions,
    demographicOptions,
    surveyPosition,
    surveyQuestions,
    type CommunityAnswers,
    answerQuestion,
    surveyAnswer,
} from "../convex/members/demographics";
import { summarise } from "../convex/members/audience";
import { allLanguages, languages } from "../convex/members/languages";

test("startup motivations coexist with existing answers", () => {
    const answers: CommunityAnswers = {
        demographics: {},
        interests: [],
        motivations: ["learning", "opportunities"],
        participation: ["attend"],
    };
    const motivations = [
        ...answers.motivations,
        "starting-company",
        "joining-startup",
        "cofounders",
        "hiring",
        "customers",
        "backing-startups",
    ];
    const updated = answerQuestion(answers, "motivations", motivations);
    expect(updated.motivations).toEqual(motivations);
    expect(updated.participation).toEqual(["attend"]);
    expect(answers.motivations).toEqual(["learning", "opportunities"]);
});

test("discovery accepts multiple choices and preserves completed legacy surveys", () => {
    const answers: CommunityAnswers = {
        demographics: {},
        interests: [],
        motivations: [],
        participation: [],
    };
    expect(answerQuestion(answers, "discovery", ["friend"]).demographics.discovery).toEqual([
        "friend",
    ]);
    expect(() => answerQuestion(answers, "discovery", ["invented"])).toThrow();
    expect(
        answerQuestion(answers, "discovery", ["friend", "linkedin"]).demographics.discovery,
    ).toEqual(["friend", "linkedin"]);
    expect(() => answerQuestion(answers, "discovery", ["friend", "friend"])).toThrow();
    expect(answerQuestion(answers, "discovery", []).demographics.discovery).toEqual([]);
    expect(
        surveyAnswer({ ...answers, demographics: { discovery: "friend" } }, "discovery"),
    ).toEqual(["friend"]);
    expect(demographicOptions.discovery).toHaveLength(12);
    expect(
        surveyPosition(
            answers,
            surveyQuestions.filter((question) => question !== "discovery"),
            true,
        ),
    ).toBe("overview");
    expect(
        surveyPosition(
            answers,
            surveyQuestions.filter((question) => question !== "discovery"),
        ),
    ).toBe(surveyQuestions.indexOf("discovery"));
});

test("test_label_every_language_without_raw_codes_or_duplicate_names", () => {
    expect(allLanguages).toHaveLength(184);
    expect(new Set(allLanguages.map((language) => language.value)).size).toBe(184);
    expect(new Set(allLanguages.map((language) => language.label)).size).toBe(184);
    for (const language of allLanguages) {
        expect(language.label.length).toBeGreaterThan(2);
        expect(language.label).not.toBe(language.value);
    }
    for (const language of languages) expect(allLanguages).toContainEqual(language);
    expect(allLanguages.filter(({ value }) => ["aa", "ab", "ae"].includes(value))).toEqual([
        { value: "ab", label: "Abkhazian" },
        { value: "aa", label: "Afar" },
        { value: "ae", label: "Avestan" },
    ]);
});

test("test_resume_all_survey_states_without_a_midway_stop", () => {
    const answers: CommunityAnswers = {
        demographics: {},
        interests: [],
        motivations: [],
        participation: [],
    };
    expect(surveyPosition(answers, [])).toBe(0);
    for (let index = 0; index < surveyQuestions.length; index++) {
        expect(surveyPosition(answers, surveyQuestions.slice(0, index))).toBe(index);
    }
    expect(surveyPosition(answers, surveyQuestions)).toBe("overview");
    expect(surveyPosition(answers, [], true)).toBe("overview");

    // existing answers and explicit skips both count as progress
    expect(
        surveyPosition(
            { ...answers, interests: ["hardware"], demographics: { eventsAttended: "0" } },
            ["eventFrequency"],
        ),
    ).toBe(surveyQuestions.indexOf("eventKinds"));
});

test("event kinds accept multiple choices without resetting completed surveys", () => {
    const answers: CommunityAnswers = {
        demographics: {},
        interests: [],
        motivations: [],
        participation: [],
    };
    const updated = answerQuestion(answers, "eventKinds", ["talks", "hikes", "workshops"]);
    expect(updated.demographics.eventKinds).toEqual(["talks", "hikes", "workshops"]);
    expect(() => answerQuestion(answers, "eventKinds", ["talks", "talks"])).toThrow();
    expect(() => answerQuestion(answers, "eventKinds", ["invented"])).toThrow();
    expect(answerQuestion(updated, "eventKinds", []).demographics.eventKinds).toEqual([]);
    expect(
        surveyPosition(
            answers,
            surveyQuestions.filter((question) => question !== "eventKinds"),
            true,
        ),
    ).toBe("overview");
    expect(surveyQuestions).toHaveLength(14);
    expect(new Set(surveyQuestions).size).toBe(14);
});

test("test_accept_sales_without_reinterpreting_legacy_roles", () => {
    expect(() => validateDemographics({ roles: ["sales", "other", "engineering"] })).not.toThrow();
    expect(
        demographicOptions.roles.filter((option) =>
            ["sales", "other", "engineering"].includes(option.value),
        ),
    ).toEqual([
        { value: "engineering", label: "Engineer" },
        { value: "sales", label: "Sales" },
        { value: "other", label: "Other" },
    ]);
});

test("test_accept_nine_distinct_participation_choices_with_stable_values", () => {
    expect(participationOptions).toEqual([
        { value: "attend", label: "Attend" },
        { value: "speak", label: "Speak" },
        { value: "demo", label: "Demo" },
        { value: "host", label: "Host" },
        { value: "teach", label: "Teach" },
        { value: "organise", label: "Organise" },
        { value: "mentor", label: "Mentor" },
        { value: "sponsor", label: "Sponsor" },
        { value: "volunteer", label: "Help out" },
    ]);
    expect(() => validateParticipation([])).not.toThrow();
    expect(() =>
        validateParticipation(participationOptions.map((option) => option.value)),
    ).not.toThrow();

    // reject repeated choices and labels mistakenly submitted as stored values
    for (const { value } of participationOptions) {
        expect(() => validateParticipation([value, value])).toThrow(
            "Choose each way to participate once from the available options.",
        );
    }
    for (const value of ["Help out", "help-out", "Demo", "Host", "Teach", "unknown"]) {
        expect(() => validateParticipation([value])).toThrow(
            "Choose each way to participate once from the available options.",
        );
    }
});

// count each respondent once while retaining exact totals for every group
test("test_report_exact_audience_counts_and_percentages", () => {
    const values = [
        ...Array.from({ length: 5 }, () => ["engineering", "research"]),
        ...Array(4).fill(["student"]),
        null,
        undefined,
    ];
    const result = summarise(values, [
        { value: "engineering", label: "Engineering" },
        { value: "research", label: "Research" },
        { value: "student", label: "Student" },
    ]);
    expect(result).toEqual({
        responses: 9,
        total: 11,
        withheld: 1,
        groups: [
            { label: "Engineering", count: 5, percentage: 56 },
            { label: "Research", count: 5, percentage: 56 },
            { label: "Student", count: 4, percentage: 44 },
        ],
    });
});

test("test_report_single_and_empty_audience_groups", () => {
    const options = [{ value: "CH", label: "Switzerland" }];
    expect(summarise(["CH", null, undefined], options)).toEqual({
        responses: 1,
        total: 3,
        withheld: 1,
        groups: [{ label: "Switzerland", count: 1, percentage: 100 }],
    });
    expect(summarise([null, undefined, []], options)).toEqual({
        responses: 0,
        total: 3,
        withheld: 1,
        groups: [{ label: "Switzerland", count: 0, percentage: 0 }],
    });
});

test("test_exclude_blank_answers_without_counting_multi_selects_twice", () => {
    // blank values are unanswered; repeated selections still represent one respondent
    expect(
        summarise(
            ["", "  ", [], [""], null, undefined, ["CH", "CH"]],
            [{ value: "CH", label: "Switzerland" }],
        ),
    ).toEqual({
        responses: 1,
        total: 7,
        withheld: 1,
        groups: [{ label: "Switzerland", count: 1, percentage: 100 }],
    });
    expect(summarise([], [])).toEqual({ responses: 0, total: 0, withheld: 0, groups: [] });
});

// Only explicit, distinct motivations may be stored; an empty list clears the answer.
test("community motivations reject unknown and duplicate choices", () => {
    expect(() => validateMotivations([])).not.toThrow();
    expect(() => validateMotivations(["friends", "collaborators"])).not.toThrow();
    expect(() => validateMotivations(["friends", "friends"])).toThrow();
    expect(() => validateMotivations(["admin"])).toThrow();
});

// Citizenship can be multiple; omission and refusal stay distinct from selected countries.
test("country answers accept ISO codes and reject unknown or duplicate countries", () => {
    expect(() =>
        validateDemographics({ residence: "CH", citizenships: ["CH", "DE"] }),
    ).not.toThrow();
    expect(() => validateDemographics({ residence: null, citizenships: null })).not.toThrow();
    expect(() => validateDemographics({})).not.toThrow();
    expect(() => validateDemographics({ residence: "Zurich" })).toThrow();
    expect(() => validateDemographics({ citizenships: ["CH", "CH"] })).toThrow();
    expect(() => validateDemographics({ citizenships: ["XX"] })).toThrow();
});

test("working languages accept multiple explicit answers and reject invented choices", () => {
    expect(() => validateDemographics({ languages: ["en", "de"] })).not.toThrow();
    expect(() => validateDemographics({ languages: null })).not.toThrow();
    expect(() => validateDemographics({ languages: ["en", "en"] })).toThrow();
    expect(() => validateDemographics({ languages: ["invented"] })).toThrow();
});

test("test_accept_and_count_russian_and_chinese", () => {
    // use the shared choices for profile validation and audience reporting
    const languages = ["ru", "zh"];
    expect(() => validateDemographics({ languages })).not.toThrow();
    const options = demographicOptions.languages.filter((option) =>
        languages.includes(option.value),
    );
    expect(options).toEqual([
        { value: "zh", label: "Chinese" },
        { value: "ru", label: "Russian" },
    ]);
    expect(summarise([languages], options)).toEqual({
        responses: 1,
        total: 1,
        withheld: 0,
        groups: [
            { label: "Chinese", count: 1, percentage: 100 },
            { label: "Russian", count: 1, percentage: 100 },
        ],
    });
});

test("test_accept_curated_languages_without_duplicates_or_reclassifying_answers", () => {
    const options = demographicOptions.languages;
    expect(options.length).toBe(16);
    expect(new Set(options.map((option) => option.value)).size).toBe(options.length);
    expect(() =>
        validateDemographics({ languages: options.map((option) => option.value) }),
    ).not.toThrow();
    expect(options.filter((option) => ["de", "ta", "zh"].includes(option.value))).toEqual([
        { value: "zh", label: "Chinese" },
        { value: "de", label: "German" },
        { value: "ta", label: "Tamil" },
    ]);
});

test("test_distinguish_schooling_and_professional_education_in_reports", () => {
    const options = demographicOptions.education.filter((option) =>
        ["compulsory", "upper-secondary", "professional", "secondary"].includes(option.value),
    );
    expect(
        summarise(["compulsory", "upper-secondary", "professional", "secondary"], options),
    ).toEqual({
        responses: 4,
        total: 4,
        withheld: 0,
        groups: options.map((option) => ({ label: option.label, count: 1, percentage: 25 })),
    });
});
