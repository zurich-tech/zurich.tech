import { expect, test } from "bun:test";
import { organisationOrder, pickOrganisation } from "../src/map/hover";

/** Create a symbol-query result without requiring a WebGL context. */
function marker(
    name: string,
    kind: "ordinary" | "group" | "host" | "sponsor",
    layer = "organisations",
) {
    return {
        name,
        layer: { id: layer },
        properties: {
            isLogo: kind === "host" || kind === "sponsor",
            isSponsor: kind === "sponsor",
            count: kind === "group" ? 3 : 1,
        },
    };
}

/** Resolve sponsor rectangles above overlapping dots, groups and hosts regardless of query order. */
test("test_pick_frontmost_sponsor_not_first_queried_symbol", () => {
    const hits = [
        marker("dot", "ordinary", "organisation-dots"),
        marker("ordinary", "ordinary"),
        marker("group", "group"),
        marker("host", "host"),
        marker("DM", "sponsor"),
    ];
    for (const zoom of [10, 12, 12.5, 13, 16]) {
        for (let offset = 0; offset < hits.length; offset++) {
            const ordered = [...hits.slice(offset), ...hits.slice(0, offset)];
            expect(pickOrganisation(ordered, zoom)?.name).toBe("DM");
            expect(pickOrganisation(ordered.reverse(), zoom)?.name).toBe("DM");
        }
    }
    expect(hits.slice(1).map((hit) => organisationOrder(hit.properties))).toEqual([0, 1, 2, 3]);
});

/** Exclude transparent badges and decoration without losing visible overview dots. */
test("test_pick_only_visible_marker_layers", () => {
    const badge = marker("badge", "ordinary");
    const dot = marker("dot", "ordinary", "organisation-dots");
    const ring = marker("ring", "sponsor", "organisations-active");
    expect(pickOrganisation([ring, badge, dot], 12)?.name).toBe("dot");
    expect(pickOrganisation([dot, badge], 12.5)?.name).toBe("dot");
    expect(pickOrganisation([dot, badge], 13.5)?.name).toBe("badge");
    expect(pickOrganisation([dot], 14)).toBeUndefined();
    expect(pickOrganisation([badge], 12)).toBeUndefined();
    expect(pickOrganisation([ring], 16)).toBeUndefined();
    expect(pickOrganisation([], 16)).toBeUndefined();
});

/** Exclude invisible stacks without losing shared-address dots during zoom. */
test("test_pick_shared_dots_until_their_stack_becomes_visible", () => {
    const stack = marker("stack", "group", "organisation-stacks");
    const dot = marker("dot", "group", "organisation-group-dots");
    expect(pickOrganisation([stack, dot], 13.99)?.name).toBe("dot");
    expect(pickOrganisation([stack, dot], 14)?.name).toBe("dot");
    expect(pickOrganisation([dot, stack], 14.5)?.name).toBe("stack");
    expect(pickOrganisation([dot], 15)).toBeUndefined();
    const plain = { ...stack, properties: { ...stack.properties, badge: "group-dot" } };
    expect(pickOrganisation([plain], 12)).toBe(plain);
});

/** Keep MapLibre's ordering for symbols with equal drawing priority. */
test("test_preserve_order_for_equal_marker_priorities", () => {
    const first = marker("first", "sponsor");
    const second = marker("second", "sponsor");
    expect(pickOrganisation([first, second], 14)).toBe(first);
    expect(pickOrganisation([second, first], 14)).toBe(second);
});
