import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { sheetDestination, sheetHeights, sheetKey, sheetPosition } from "../src/map/sheet";

test("test_keep_counts_informational_and_toggle_results_without_discarding_selection", () => {
    const source = readFileSync(new URL("../src/map/map.tsx", import.meta.url), "utf8");
    const count = source.split('class="map-count"')[1].split("</span>")[0];
    const toggle = source.split('class="map-panel-action map-toggle"')[1].split("</button>")[0];

    // keep the count inert and use the same state-preserving action as the mobile handle
    expect(count).not.toContain("onClick");
    expect(toggle).toContain("showSheet(!isPanelOpen())");
    expect(toggle).toContain("<ChevronDown size={18} />");
    expect(toggle).not.toContain("setSelected");
    expect(source).toContain('class="map-results-footer"');
    expect(source).not.toContain('class="map-panel-action map-add"');
});

test("test_escape_clears_expansion_and_pending_drag_before_returning_focus", () => {
    const source = readFileSync(new URL("../src/map/map.tsx", import.meta.url), "utf8");
    const escape = source
        .split('else if (event.key === "Escape" && isPanelOpen()) {')[1]
        .split("\n                }")[0];

    // protect the component wiring: closing expanded results must leave the compact reopening state
    expect(escape.trim()).toBe(
        [
            "event.stopPropagation();",
            "                    discardSheetDrag();",
            "                    setPanelOpen(false);",
            "                    setExpanded(false);",
            "                    setHovered([]);",
            "                    instance()?.map.getCanvas().focus({ preventScroll: true });",
        ].join("\n"),
    );
});

test("test_place_a_compact_drag_bar_above_the_full_width_mobile_search", () => {
    const css = readFileSync(new URL("../src/map/map.css", import.meta.url), "utf8");
    const mobile = css.split("@media (max-width: 800px) {")[1].split("/* keep a useful map")[0];
    const handle = mobile.match(/\.map-sheet-handle \{([^}]+)\}/)![1];
    const tools = mobile.match(/\.map-directory-tools \{([^}]+)\}/)![1];

    // reserve the full grab target above search without overlapping its input
    expect(handle).toContain("width: 100%;");
    expect(handle).toContain("height: 28px;");
    expect(handle).toContain("top: 0;");
    expect(handle).toContain("touch-action: none;");
    expect(tools).not.toContain("border-top");
    expect(tools).toContain("padding: 28px 12px 8px;");
    expect(mobile.match(/\.map-sheet-handle span \{([^}]+)\}/)![1]).toContain("height: 4px;");
    expect(mobile.match(/\.map-directory-tools > \.map-search \{([^}]+)\}/)![1]).toContain(
        "grid-column: 1 / -1;",
    );
    expect(tools).toContain("overflow-y: auto;");

    // retain the preexisting spacing when landscape hides the grab target entirely
    const landscape = css.split("and (orientation: landscape) {")[1];
    expect(landscape.match(/\.map-sheet-handle \{([^}]+)\}/)![1]).toContain("display: none;");
    const landscapeTools = landscape.match(/\.map-directory-tools \{([^}]+)\}/)![1];
    expect(landscapeTools).toContain("padding-top: 16px;");
    expect(landscape.match(/\.map-toggle \{([^}]+)\}/)![1]).toContain("display: grid;");

    const compact = css.split("/* keep the count beside both triggers")[1];
    expect(compact.match(/\.map-browse \{([^}]+)\}/)![1]).toContain("grid-row: 1;");
    expect(compact.match(/\.map-filters__chips \{([^}]+)\}/)![1]).toContain("grid-row: 2;");
});

test("test_open_and_close_with_one_activation_and_expose_keyboard_resizing", () => {
    const source = readFileSync(new URL("../src/map/map.tsx", import.meta.url), "utf8");
    const control = source.split("ref={handle}")[1].split("</button>")[0];

    expect(control).toContain("showSheet(!isPanelOpen());");
    expect(control).toContain('aria-keyshortcuts="ArrowUp ArrowDown Home End"');
    expect(control).toContain("sheetKey(");
    expect(control).toContain('"Close map results" : "Open map results"');
    expect(control).toContain('<span aria-hidden="true" />');
});

test("test_prevent_native_drag_beneath_the_moving_handle_without_losing_focus", () => {
    const source = readFileSync(new URL("../src/map/map.tsx", import.meta.url), "utf8");
    const pointer = source
        .split("ref={handle}")[1]
        .split("onPointerDown={(event) => {")[1]
        .split("onPointerMove=")[0];

    // browser QA separately proves the native dragstart no longer cancels sheet expansion
    expect(pointer.indexOf("event.preventDefault();")).toBeLessThan(
        pointer.indexOf("startSheet(event.clientY);"),
    );
    expect(pointer).toContain("event.currentTarget.focus({ preventScroll: true });");
    expect(pointer).toContain("event.currentTarget.setPointerCapture(event.pointerId);");
});

test("test_resize_the_sheet_with_keyboard_steps_and_endpoints", () => {
    const states = [
        { isOpen: false, isExpanded: false },
        { isOpen: true, isExpanded: false },
        { isOpen: true, isExpanded: true },
    ];
    for (let index = 0; index < states.length; index++) {
        const { isOpen, isExpanded } = states[index];
        expect(sheetKey("ArrowUp", isOpen, isExpanded)).toEqual(states[Math.min(2, index + 1)]);
        expect(sheetKey("ArrowDown", isOpen, isExpanded)).toEqual(states[Math.max(0, index - 1)]);
        expect(sheetKey("Home", isOpen, isExpanded)).toEqual(states[0]);
        expect(sheetKey("End", isOpen, isExpanded)).toEqual(states[2]);
        expect(sheetKey("Escape", isOpen, isExpanded)).toBeUndefined();
        expect(sheetKey("Enter", isOpen, isExpanded)).toBeUndefined();
    }
});

test("test_fit_sheet_positions_to_the_viewport_and_controls", () => {
    expect(sheetHeights(800, 200)).toEqual([200, 480, 788]);
    expect(sheetHeights(300, 200)).toEqual([200, 200, 288]);
    expect(sheetHeights(150, 200)).toEqual([138, 138, 138]);
});

test("test_snap_drags_without_skipping_nearby_positions", () => {
    const heights = [200, 480, 788];
    expect(sheetPosition(heights, 200, -80)).toBe(1);
    expect(sheetPosition(heights, 480, -80)).toBe(2);
    expect(sheetPosition(heights, 788, 80)).toBe(1);
    expect(sheetPosition(heights, 480, 80)).toBe(0);
    expect(sheetPosition(heights, 200, -500)).toBe(2);
    expect(sheetPosition(heights, 480, 3)).toBe(1);
    expect(sheetPosition(heights, 200, 100)).toBe(0);
    expect(sheetPosition(heights, 788, -100)).toBe(2);
});

test("test_snap_from_the_rendered_compact_height", () => {
    const heights = sheetHeights(700, 120, 100);

    expect(heights).toEqual([120, 220, 688]);
    expect(sheetPosition(heights, 220, -60)).toBe(2);
    expect(sheetPosition(heights, 220, 6)).toBe(1);
    expect(sheetPosition(heights, 220, 60)).toBe(0);
    expect(sheetPosition(heights, 688, 60)).toBe(1);
    expect(sheetHeights(150, 200, 220)).toEqual([138, 138, 138]);
    expect(sheetHeights(700, 120, 0)).toEqual([120, 120, 688]);
});

test("test_restore_each_original_sheet_state_on_cancellation", () => {
    for (const state of [
        { isOpen: false, isExpanded: false },
        { isOpen: true, isExpanded: false },
        { isOpen: true, isExpanded: true },
        { isOpen: false, isExpanded: true },
    ]) {
        const drag = { y: 400, height: 220, heights: [120, 220, 688], ...state };

        expect(sheetDestination(drag, 600, true)).toEqual(state);
        expect(sheetDestination(drag, 100, true)).toEqual(state);
    }
});

test("test_release_compact_details_into_expanded_or_collapsed_state", () => {
    const drag = {
        y: 400,
        height: 220,
        heights: sheetHeights(700, 120, 100),
        isOpen: true,
        isExpanded: false,
    };

    expect(sheetDestination(drag, 340, false)).toEqual({ isOpen: true, isExpanded: true });
    expect(sheetDestination(drag, 406, false)).toEqual({ isOpen: true, isExpanded: false });
    expect(sheetDestination(drag, 460, false)).toEqual({ isOpen: false, isExpanded: false });
});

test("test_open_collapsed_compact_content_at_its_measured_stop", () => {
    const heights = sheetHeights(700, 120, 100);
    const collapsed = { y: 400, height: 120, heights, isOpen: false, isExpanded: false };

    expect(heights).toEqual([120, 220, 688]);
    expect(sheetDestination(collapsed, 340, false)).toEqual({ isOpen: true, isExpanded: false });
    expect(sheetDestination(collapsed, 340, true)).toEqual({ isOpen: false, isExpanded: false });
    expect(sheetHeights(300, 160, 100)).toEqual([160, 180, 288]);
    expect(sheetHeights(150, 138, 100)).toEqual([138, 138, 138]);
});

test("test_preserve_logical_state_when_short_viewport_stops_coincide", () => {
    const compact = {
        y: 400,
        height: 200,
        heights: sheetHeights(300, 200),
        isOpen: true,
        isExpanded: false,
    };
    expect(sheetDestination(compact, 406, false)).toEqual({ isOpen: true, isExpanded: false });
    expect(sheetDestination(compact, 340, false)).toEqual({ isOpen: true, isExpanded: true });

    const expanded = { ...compact, height: 138, heights: sheetHeights(150, 200), isExpanded: true };
    expect(sheetDestination(expanded, 406, false)).toEqual({ isOpen: true, isExpanded: true });
    expect(sheetDestination(expanded, 460, false)).toEqual({ isOpen: true, isExpanded: false });
    expect(sheetDestination(expanded, 460, true)).toEqual({ isOpen: true, isExpanded: true });
});

test("test_size_a_single_result_to_content_without_exceeding_the_list_cap", () => {
    const heights = sheetHeights(788, 117, 96);

    expect(heights).toEqual([117, 213, 776]);
    expect(sheetHeights(788, 117, 900)[1]).toBeCloseTo(472.8, 8);
    expect(sheetPosition(heights, 213, -60, 1)).toBe(2);
    expect(sheetPosition(heights, 776, 60, 2)).toBe(1);
});
