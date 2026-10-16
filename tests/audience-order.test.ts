import { expect, test } from "bun:test";
import { rankAnswers } from "../src/members/audience";

test("test_rank_categorical_answers_by_popularity_then_name_without_mutation", () => {
    const groups = [
        { label: "Switzerland", count: 4 },
        { label: "Austria", count: 1 },
        { label: "Italy", count: 6 },
        { label: "Germany", count: 4 },
        { label: "Brazil", count: 0 },
    ];
    const original = structuredClone(groups);

    expect(rankAnswers(groups)).toEqual([groups[2], groups[3], groups[0], groups[1], groups[4]]);
    expect(groups).toEqual(original);
    expect(rankAnswers([])).toEqual([]);
});

test("test_rank_ordered_survey_answers_by_popularity", () => {
    const groups = [
        { label: "Not started yet", count: 1 },
        { label: "Under 2 years", count: 7 },
        { label: "2–5 years", count: 12 },
        { label: "6–10 years", count: 8 },
        { label: "11–20 years", count: 10 },
        { label: "21+ years", count: 4 },
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
