import { expect, test } from "bun:test";
import {
    searchTerms,
    matchesSearch,
    highlightParts,
    indexRecords,
    searchRecords,
} from "../convex/search/ranking";

test("accent-insensitive matching highlights original text without injecting markup", () => {
    const text = "Zürich · Cäsar <script>";
    const terms = searchTerms("zurich casar");
    expect(matchesSearch(text, terms)).toBe(true);
    const parts = highlightParts(text, terms);
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.isMatch).map((part) => part.text)).toEqual([
        "Zürich",
        "Cäsar",
    ]);
    expect(highlightParts("Zurich", ["zur", "zurich"]).filter((part) => part.isMatch)).toEqual([
        { text: "Zurich", isMatch: true },
    ]);
});

test("the in-memory catalogue ranks, filters and highlights without another fetch", () => {
    const records = [
        {
            label: "ZurichNLP #22",
            description: "Tiago Pimentel on model causality",
            href: "/events/nlp",
            kind: "Events",
            startsAt: 200,
        },
        {
            label: "ZurichNLP",
            description: "Natural language processing",
            href: "/series/nlp",
            kind: "Series",
        },
        {
            label: "Earlier talk",
            description: "Zürich research",
            href: "/events/earlier",
            kind: "Events",
            startsAt: 50,
        },
    ];
    const index = indexRecords(records);
    expect(searchRecords(index, "pimentel", "Events")[0].href).toBe("/events/nlp");
    expect(searchRecords(index, "zurich", "Series").map((item) => item.href)).toEqual([
        "/series/nlp",
    ]);
    expect(searchRecords(index, "upcoming", "Events", 5, 100).map((item) => item.href)).toEqual([
        "/events/nlp",
    ]);
    expect(searchRecords(index, "past", "Events", 5, 100).map((item) => item.href)).toEqual([
        "/events/earlier",
    ]);
    expect(
        searchRecords(index, "zurich", "Events")[1].descriptionParts.some(
            (part) => part.isMatch && part.text === "Zürich",
        ),
    ).toBe(true);
    expect(searchRecords(indexRecords(records.slice(1)), "pimentel")).toEqual([]);
});
