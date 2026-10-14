import { expect, test } from "bun:test";
import { selectSpecificTopic } from "../src/topics/selection";

const topics = [
    { slug: "ai" },
    { slug: "nlp", parent: "ai" },
    { slug: "agents", parent: "ai" },
    { slug: "hardware" },
];

test("test_replace_parent_with_specific_subject_without_losing_unrelated_choices", () => {
    expect(selectSpecificTopic(["ai", "hardware"], "nlp", topics)).toEqual(["hardware", "nlp"]);
    expect(selectSpecificTopic(["nlp", "hardware"], "agents", topics)).toEqual([
        "nlp",
        "hardware",
        "agents",
    ]);
});

test("test_replace_descendants_with_explicit_broad_subject_without_duplicates", () => {
    expect(selectSpecificTopic(["nlp", "agents", "hardware"], "ai", topics)).toEqual([
        "hardware",
        "ai",
    ]);
    expect(selectSpecificTopic(["nlp"], "nlp", topics)).toEqual(["nlp"]);
});
