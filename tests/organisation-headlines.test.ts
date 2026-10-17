import { expect, test } from "bun:test";
import { normalizeHeadline } from "../convex/organisations/headlines";

test("test_normalize_headlines_without_changing_internal_punctuation", () => {
    for (const [input, expected] of [
        ["Builds robots.", "Builds robots"],
        ["  Builds robots.  ", "Builds robots"],
        ["Builds robots", "Builds robots"],
        ["Uses .NET. Works with robots.", "Uses .NET. Works with robots"],
        ["Builds robots...", "Builds robots"],
        ["", ""],
    ]) {
        expect(normalizeHeadline(input!)).toBe(expected!);
        expect(normalizeHeadline(normalizeHeadline(input!))).toBe(expected!);
    }
});
