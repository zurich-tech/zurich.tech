import { expect, test } from "bun:test";
import { convexTest, schema, modules } from "./backend";
import { internal } from "../convex/_generated/api";
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

test("test_preview_and_clean_existing_headlines_idempotently", async () => {
    const backend = convexTest(schema, modules);
    const id = await backend.run((ctx) =>
        ctx.db.insert("organisations", {
            name: "Example",
            slug: "example",
            kind: "company",
            website: "https://example.org",
            location: "Zurich",
            headline: "Builds robots.",
            description: "A full description.",
            updatedAt: 1,
        }),
    );
    expect(
        await backend.mutation(internal.organisations.imports.cleanHeadlines, { apply: false }),
    ).toEqual({ applied: false, count: 1, slugs: ["example"] });
    expect((await backend.run((ctx) => ctx.db.get(id)))?.headline).toBe("Builds robots.");
    expect(
        await backend.mutation(internal.organisations.imports.cleanHeadlines, { apply: true }),
    ).toEqual({ applied: true, count: 1, slugs: ["example"] });
    const saved = await backend.run((ctx) => ctx.db.get(id));
    expect(saved?.headline).toBe("Builds robots");
    expect(saved?.description).toBe("A full description.");
    expect(
        await backend.mutation(internal.organisations.imports.cleanHeadlines, { apply: true }),
    ).toEqual({ applied: true, count: 0, slugs: [] });
});
