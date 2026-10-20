import { expect, test } from "bun:test";
import { rankAnswers } from "../src/members/audience";

test("test_rank_categorical_answers_by_popularity_then_name_without_mutation", () => {
    const groups = [
        { label: "Switzerland", count: 4, percentage: 27 },
        { label: "Austria", count: 1, percentage: 7 },
        { label: "Italy", count: 6, percentage: 40 },
        { label: "Germany", count: 4, percentage: 27 },
        { label: "Brazil", count: 0, percentage: 0 },
    ];
    const original = structuredClone(groups);

    expect(rankAnswers(groups)).toEqual([groups[2], groups[3], groups[0], groups[1], groups[4]]);
    expect(groups).toEqual(original);
    expect(rankAnswers([])).toEqual([]);
});

test("test_rank_ordered_survey_answers_by_popularity", () => {
    const groups = [
        { label: "Not started yet", count: 1, percentage: 2 },
        { label: "Under 2 years", count: 7, percentage: 17 },
        { label: "2–5 years", count: 12, percentage: 29 },
        { label: "6–10 years", count: 8, percentage: 19 },
        { label: "11–20 years", count: 10, percentage: 24 },
        { label: "21+ years", count: 4, percentage: 10 },
    ];

    expect(rankAnswers(groups)).toEqual([
        groups[2],
        groups[4],
        groups[3],
        groups[1],
        groups[5],
        groups[0],
    ]);
});

test("test_rank_answers_with_different_option_coverage_by_displayed_percentage", () => {
    const groups = [
        { label: "Attend", count: 48, percentage: 96 },
        { label: "Speak", count: 23, percentage: 46 },
        { label: "Organise", count: 17, percentage: 34 },
        { label: "Mentor", count: 15, percentage: 30 },
        { label: "Help out", count: 14, percentage: 40 },
        { label: "Demo", count: 3, percentage: 33 },
        { label: "Sponsor", count: 2, percentage: 4 },
        { label: "Teach", count: 2, percentage: 22 },
        { label: "Host", count: 1, percentage: 11 },
    ];
    const original = structuredClone(groups);

    expect(rankAnswers(groups)).toEqual([
        groups[0],
        groups[1],
        groups[4],
        groups[2],
        groups[5],
        groups[3],
        groups[7],
        groups[8],
        groups[6],
    ]);
    expect(groups).toEqual(original);
});

test("test_rank_equal_percentages_by_count_then_name", () => {
    const groups = [
        { label: "Teach", count: 2, percentage: 20 },
        { label: "Mentor", count: 10, percentage: 20 },
        { label: "Demo", count: 2, percentage: 20 },
    ];

    expect(rankAnswers(groups)).toEqual([groups[1], groups[2], groups[0]]);
});
