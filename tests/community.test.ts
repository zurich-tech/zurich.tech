import { expect, test } from "bun:test";
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
