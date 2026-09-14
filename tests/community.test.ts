import { expect, test } from "bun:test";
import { validateDemographics, validateMotivations } from "../convex/members/demographics";
import { summarise } from "../convex/members/audience";

// Multiple roles count respondents once; suppressed cells must not leak through percentages.
test("community statistics separate refusals and suppress small counts and percentages", () => {
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
    expect(result.responses).toBe(9);
    expect(result.total).toBe(11);
    expect(result.groups[0]).toEqual({ label: "Engineering", count: 5, percentage: 56 });
    expect(result.groups[1].percentage).toBe(56);
    expect(result.groups[2]).toEqual({ label: "Student", count: null, percentage: null });
    expect(result.withheld).toBeNull();
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
