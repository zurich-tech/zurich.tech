import { describe, expect, test } from "bun:test";

import { highlightParts, matchesSearch, searchExcerpt, searchScore, searchTerms } from "./search";

describe("search", () => {
    test("test_normalize_query_terms", () => {
        expect(searchTerms("  AI #zurich AI  ")).toEqual(["ai", "zurich"]);
    });

    test("test_match_terms_in_any_order", () => {
        const terms = searchTerms("langstrasse agents");

        expect(matchesSearch("Agents meetup at Langstrasse", terms)).toBe(true);
        expect(matchesSearch("Agents meetup in Oerlikon", terms)).toBe(false);
    });

    test("test_rank_label_before_context_and_text", () => {
        const terms = searchTerms("events");
        const exact = searchScore({ context: "page", label: "events", text: "calendar" }, terms);
        const context = searchScore({ context: "events", label: "calendar", text: "dates" }, terms);
        const text = searchScore({ context: "page", label: "calendar", text: "all events" }, terms);

        expect([exact, context, text]).toEqual([1000, 100, 10]);
    });

    test("test_highlight_original_case", () => {
        expect(highlightParts("Zurich AI Meetup", ["zurich", "meet"])).toEqual([
            { isMatch: true, text: "Zurich" },
            { isMatch: false, text: " AI " },
            { isMatch: true, text: "Meet" },
            { isMatch: false, text: "up" },
        ]);
    });

    test("test_extract_matching_excerpt", () => {
        expect(searchExcerpt("A compact public event calendar for Zurich.", ["event"])).toBe(
            "A compact public event calendar for Zurich.",
        );
    });
});
