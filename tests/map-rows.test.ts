import { expect, test } from "bun:test";
import { createMemo, createRenderEffect, createRoot, createSelector, createSignal } from "solid-js";
import { isServer } from "solid-js/web";
import { nameTerms } from "../src/map/filter";
import { highlightParts, searchTerms } from "../src/search/search";

test("test_preserve_exact_name_highlights_and_reuse_unchanged_terms", () => {
    for (const name of ["Akina", "Zürich Instruments", "ETH AI Center", "a-metal"]) {
        for (const query of ["", "Technopark", "zurich", "AI", "a metal", "eth technopark"]) {
            const terms = searchTerms(query);
            const matching = nameTerms(name, terms);
            expect(highlightParts(name, matching)).toEqual(highlightParts(name, terms));
            expect(nameTerms(name, terms, matching)).toBe(matching);
        }
    }

    const plain: readonly string[] = [];
    expect(nameTerms("Akina", ["technopark"], plain)).toBe(plain);
    const highlighted = nameTerms("Akina", ["akina"]);
    expect(nameTerms("Akina", ["akina", "technopark"], highlighted)).toBe(highlighted);
    expect(nameTerms("Akina", [], highlighted)).toEqual([]);
});

test("test_update_only_changed_row_highlights_and_hover_states", () => {
    // exercise Solid's browser subscriptions, not its static server implementation
    if (isServer) {
        const result = Bun.spawnSync([
            process.execPath,
            "--conditions=browser",
            "test",
            import.meta.path,
        ]);
        expect(result.exitCode).toBe(0);
        return;
    }

    const app = createRoot((dispose) => {
        const [terms, setTerms] = createSignal<readonly string[]>([]);
        const [hovered, setHovered] = createSignal<string[]>([]);
        const isHovered = createSelector(hovered, (id: string, ids) => ids.includes(id));
        const highlights = Array(1000).fill(0);
        const hovers = Array(1000).fill(0);
        for (let index = 0; index < 1000; index++) {
            const matching = createMemo<readonly string[]>(
                (previous) => nameTerms(`Company ${index}`, terms(), previous),
                [],
            );
            createRenderEffect(() => {
                matching();
                highlights[index]++;
            });
            createRenderEffect(() => {
                isHovered(String(index));
                hovers[index]++;
            });
        }

        return { dispose, setTerms, setHovered, highlights, hovers };
    });

    try {
        app.setTerms(["technopark"]);
        expect(app.highlights).toEqual(Array(1000).fill(1));
        app.setTerms(["company"]);
        expect(app.highlights).toEqual(Array(1000).fill(2));
        app.setTerms(["company", "technopark"]);
        expect(app.highlights).toEqual(Array(1000).fill(2));

        app.setHovered(["12"]);
        app.setHovered(["13"]);
        app.setHovered(["13"]);
        expect(app.hovers).toEqual(
            Array.from({ length: 1000 }, (_, index) => (index === 12 ? 3 : index === 13 ? 2 : 1)),
        );
    } finally {
        app.dispose();
    }
});
