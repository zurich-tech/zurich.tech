import { expect, test } from "bun:test";
import { makeFunctionReference } from "convex/server";
import { convexTest, schema, modules } from "./backend";

const clean = makeFunctionReference<"mutation">("organisations/imports:cleanDescriptions");

test("test_preview_without_writes_and_apply_only_description_and_modification_time", async () => {
    const { backend, row, before } = await fixture();
    expect(await backend.mutation(clean, { apply: false, organisations: [row] })).toEqual({
        applied: false,
        count: 1,
        slugs: ["example"],
    });
    expect(await backend.run((ctx) => ctx.db.get(row.id))).toEqual(before);
    expect(await backend.mutation(clean, { apply: true, organisations: [row] })).toEqual({
        applied: true,
        count: 1,
        slugs: ["example"],
    });
    const after = await backend.run((ctx) => ctx.db.get(row.id));
    expect(after).toEqual({ ...before, description: row.description, updatedAt: after!.updatedAt });
    expect(after!.updatedAt).toBeGreaterThan(before!.updatedAt);
    await expect(backend.mutation(clean, { apply: true, organisations: [row] })).rejects.toThrow(
        "Organisation description changed: example.",
    );
});

test("test_reject_stale_identity_or_description_in_both_modes", async () => {
    const { backend, row, before } = await fixture();
    for (const apply of [false, true]) {
        await expect(
            backend.mutation(clean, {
                apply,
                organisations: [{ ...row, slug: "changed" }],
            }),
        ).rejects.toThrow("Organisation identity changed: changed.");
        await expect(
            backend.mutation(clean, {
                apply,
                organisations: [{ ...row, expectedDescription: "Stale.", description: "Stale" }],
            }),
        ).rejects.toThrow("Organisation description changed: example.");
    }
    expect(await backend.run((ctx) => ctx.db.get(row.id))).toEqual(before);
});

test("test_reject_duplicate_ids_or_slugs_without_partial_changes", async () => {
    const { backend, row, before } = await fixture();
    const otherId = await backend.run((ctx) =>
        ctx.db.insert("organisations", {
            name: "Other",
            slug: "other",
            kind: "company",
            website: "https://other.example",
            location: "Zurich",
            description: row.expectedDescription,
            updatedAt: 1,
        }),
    );
    for (const second of [row, { ...row, slug: "other" }, { ...row, id: otherId }]) {
        for (const apply of [false, true]) {
            await expect(
                backend.mutation(clean, { apply, organisations: [row, second] }),
            ).rejects.toThrow(`Repeated organisation: ${second.slug}.`);
            expect(await backend.run((ctx) => ctx.db.get(row.id))).toEqual(before);
        }
    }
});

test("test_reject_nonterminal_edits_whitespace_changes_and_ellipsis_cleanup", async () => {
    const { backend, row, before } = await fixture();
    for (const [expectedDescription, description] of [
        [row.expectedDescription, "Changed content"],
        ["Text. ", "Text"],
        ["Text...", "Text.."],
        ["Text", "Tex"],
        [".", ""],
        ["  Text.", "Text"],
        ["Uses 3.5 units.", "Uses 35 units"],
        ["Uses U.S. methods.", "Uses US methods"],
    ]) {
        for (const apply of [false, true]) {
            await expect(
                backend.mutation(clean, {
                    apply,
                    organisations: [{ ...row, expectedDescription, description }],
                }),
            ).rejects.toThrow("Remove exactly one terminal sentence period: example.");
        }
    }
    expect(await backend.run((ctx) => ctx.db.get(row.id))).toEqual(before);
});

test("test_bound_batches_and_reject_deleted_targets", async () => {
    const { backend, row } = await fixture();
    for (const apply of [false, true]) {
        for (const organisations of [[], Array.from({ length: 101 }, () => row)]) {
            await expect(backend.mutation(clean, { apply, organisations })).rejects.toThrow(
                "Clean between 1 and 100 reviewed descriptions.",
            );
        }
    }
    await backend.run((ctx) => ctx.db.delete(row.id));
    await expect(backend.mutation(clean, { apply: true, organisations: [row] })).rejects.toThrow(
        "Organisation identity changed: example.",
    );
});

test("test_accept_one_hundred_reviewed_entries_and_roll_back_a_later_stale_target", async () => {
    const { backend, row, before } = await fixture();
    const rows = await backend.run(async (ctx) => {
        const rows = [row];
        for (let index = 1; index < 100; index++) {
            const slug = `example-${index}`;
            const id = await ctx.db.insert("organisations", {
                name: slug,
                slug,
                kind: "company",
                website: `https://${slug}.org`,
                location: "Zurich",
                description: row.expectedDescription,
                updatedAt: 1,
            });
            rows.push({ ...row, id, slug });
        }

        return rows;
    });
    expect(await backend.mutation(clean, { apply: false, organisations: rows })).toEqual({
        applied: false,
        count: 100,
        slugs: rows.map((entry) => entry.slug),
    });

    // a stale final entry must also roll back earlier patches in the transaction
    await backend.run((ctx) => ctx.db.patch(rows[99]!.id, { description: "Changed." }));
    await expect(backend.mutation(clean, { apply: true, organisations: rows })).rejects.toThrow(
        "Organisation description changed: example-99.",
    );
    expect(await backend.run((ctx) => ctx.db.get(row.id))).toEqual(before);
});

test("test_leave_unreviewed_terminal_abbreviations_unchanged", async () => {
    const { backend, row } = await fixture();
    const id = await backend.run((ctx) =>
        ctx.db.insert("organisations", {
            name: "Other",
            slug: "other",
            kind: "company",
            website: "https://other.example",
            location: "Zurich",
            description: "Developed by Example Inc.",
            updatedAt: 1,
        }),
    );
    const before = await backend.run((ctx) => ctx.db.get(id));
    await backend.mutation(clean, { apply: true, organisations: [row] });
    expect(await backend.run((ctx) => ctx.db.get(id))).toEqual(before);
});

/** Seed a reviewed description containing internal sentences, decimals and abbreviations. */
async function fixture() {
    const backend = convexTest(schema, modules);
    const expectedDescription = "  Uses U.S. methods and 3.5 mm parts. Builds robots.";
    const id = await backend.run((ctx) =>
        ctx.db.insert("organisations", {
            name: "Example",
            slug: "example",
            kind: "company",
            website: "https://example.org",
            location: "Zurich",
            headline: "Existing headline.",
            description: expectedDescription,
            topics: ["robotics"],
            logoUrl: "https://example.org/logo.png",
            updatedAt: 1,
        }),
    );
    const before = await backend.run((ctx) => ctx.db.get(id));
    if (!before) throw new Error("Missing organisation fixture.");

    return {
        backend,
        before,
        row: {
            id,
            slug: "example",
            expectedDescription,
            description: expectedDescription.slice(0, -1),
        },
    };
}
