import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { MapNavigation, restoreMapFocus, type MapView } from "../src/map/navigation";

test("test_topic_activation_refocuses_panel_search_after_details_or_preview_close", async () => {
    // execute the component's actual handler, including its deferred focus callback
    const source = readFileSync(new URL("../src/map/map.tsx", import.meta.url), "utf8");
    const start = source.indexOf("    function filterTopic(slug: string) {");
    const end = source.indexOf("\n    /**", start);
    const handler = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(start, end));

    for (const origin of ["details", "preview"]) {
        let activeElement = origin;
        let scrollTop = 120;
        let selected = ["office"];
        let organisation: string | undefined = "member";
        let groupSearch = "old";
        let hovered = ["member"];
        let isOpen = false;
        let history = ["results"];
        let previewOpen = origin === "preview";
        const params = { q: "robot", kind: "lab", topic: "biotech" };
        const focusCalls: FocusOptions[] = [];
        const input = {
            focus(options: FocusOptions) {
                activeElement = "search";
                focusCalls.push(options);
                if (!options.preventScroll) scrollTop = 0;
            },
        };
        const context = {
            panel: {
                querySelector(selector: string) {
                    expect(selector).toBe(".map-search input");
                    return input;
                },
            },
            // the canvas cannot find its sibling panel; the previous code fails this scenario
            container: { querySelector: () => null },
            resetNavigation: () => {
                history = [];
            },
            closePreview: () => {
                previewOpen = false;
                if (origin === "preview") activeElement = "body";
            },
            setSelected: (value: string[]) => {
                selected = value;
                activeElement = "body";
            },
            setSelectedOrganisation: (value: string | undefined) => {
                organisation = value;
            },
            setGroupSearch: (value: string) => {
                groupSearch = value;
            },
            setHovered: (value: string[]) => {
                hovered = value;
            },
            setPanelOpen: (value: boolean) => {
                isOpen = value;
            },
            setParams: (value: Partial<typeof params>, options: { scroll: boolean }) => {
                expect(options).toEqual({ scroll: false });
                Object.assign(params, value);
            },
        };
        const activate = new Function(...Object.keys(context), `${handler}; return filterTopic;`)(
            ...Object.values(context),
        ) as (slug: string) => void;
        activate("robotics");
        expect(activeElement).toBe("body");
        await new Promise<void>((resolve) => queueMicrotask(resolve));

        expect({
            activeElement,
            scrollTop,
            selected,
            organisation: organisation as string | undefined,
            groupSearch,
            hovered,
            isOpen,
            history,
            previewOpen,
            params,
            focusCalls,
        }).toEqual({
            activeElement: "search",
            scrollTop: 120,
            selected: [],
            organisation: undefined,
            groupSearch: "",
            hovered: [],
            isOpen: true,
            history: [],
            previewOpen: false,
            params: { q: "robot", kind: "lab", topic: "robotics" },
            focusCalls: [{ preventScroll: true }],
        });
    }
});

test("test_restore_exact_result_focus_without_scrolling_or_confusing_shared_offices", () => {
    const focused: unknown[] = [];
    const button = (placeId: string, organisationId: string) =>
        ({
            dataset: { placeId, organisationId },
            focus: (options: FocusOptions) => focused.push({ placeId, organisationId, options }),
        }) as unknown as HTMLElement;
    const canvas = { focus: () => focused.push("canvas") } as unknown as HTMLElement;
    const buttons = [button("office", "other"), button("office", "first")];
    restoreMapFocus({ places: ["office"], organisation: "first" }, buttons, canvas);
    expect(focused).toEqual([
        { placeId: "office", organisationId: "first", options: { preventScroll: true } },
    ]);

    restoreMapFocus(undefined, buttons, canvas);
    restoreMapFocus({ places: ["removed"], organisation: "first" }, buttons, canvas);
    expect(focused.slice(1)).toEqual(["canvas", "canvas"]);
});

test("test_return_to_the_exact_results_camera_scroll_and_sheet_state_once", () => {
    const navigation = new MapNavigation();
    const results = view();
    navigation.select(results, { places: ["office"], organisation: "first" }, true);

    expect(navigation.back()).toEqual(results);
    expect(navigation.back()).toBeUndefined();
});

test("test_return_from_a_member_to_the_group_search_and_scroll", () => {
    const navigation = new MapNavigation();
    const group = {
        ...view(),
        selection: { places: ["shared-office"] },
        groupSearch: "robotics",
        scrollTop: 370,
        isExpanded: false,
    };
    navigation.select(group, { places: ["shared-office"], organisation: "member" }, false);

    expect(navigation.back()).toEqual(group);
    expect(navigation.back()).toBeUndefined();
});

test("test_discard_results_history_when_selecting_an_unrelated_marker", () => {
    const navigation = new MapNavigation();
    const organisation = { places: ["office"], organisation: "first" };
    navigation.select(view(), organisation, true);
    navigation.select(
        { ...view(), selection: organisation },
        { places: ["other-office"], organisation: "other" },
        false,
    );

    expect(navigation.back()).toBeUndefined();
});

test("test_discard_group_history_for_an_unrelated_address_or_sibling_selection", () => {
    const navigation = new MapNavigation();
    const group = { ...view(), selection: { places: ["shared-office"] } };
    const member = { places: ["shared-office"], organisation: "member" };
    navigation.select(group, member, false);
    navigation.select(
        { ...group, selection: member },
        { places: ["shared-office"], organisation: "sibling" },
        false,
    );
    expect(navigation.back()).toBeUndefined();

    navigation.select(group, { places: ["different-office"], organisation: "other" }, false);
    expect(navigation.back()).toBeUndefined();
});

test("test_reset_return_state_before_entering_a_new_browsing_context", () => {
    const navigation = new MapNavigation();
    navigation.select(view(), { places: ["office"], organisation: "first" }, true);
    navigation.reset();
    expect(navigation.back()).toBeUndefined();

    const nextResults = { ...view(), scrollTop: 95, isExpanded: false };
    navigation.select(nextResults, { places: ["new-office"], organisation: "new" }, true);
    expect(navigation.back()).toEqual(nextResults);
});

test("test_do_not_create_results_history_for_an_initial_map_marker", () => {
    const navigation = new MapNavigation();
    navigation.select(view(), { places: ["shared-office"] }, false);

    expect(navigation.back()).toBeUndefined();
});

test("test_unwind_results_group_and_member_without_losing_the_results_view", () => {
    const navigation = new MapNavigation();
    const results = view();
    const group = {
        ...view(),
        selection: { places: ["shared-office"] },
        groupSearch: "robotics",
        scrollTop: 370,
    };
    navigation.select(results, group.selection, true);
    navigation.select(group, { places: ["shared-office"], organisation: "member" }, false);

    expect(navigation.back()).toEqual(group);
    expect(navigation.back()).toEqual(results);
    expect(navigation.back()).toBeUndefined();
});

test("test_clear_all_nested_destinations_when_the_browsing_context_changes", () => {
    const navigation = new MapNavigation();
    const group = { ...view(), selection: { places: ["shared-office"] } };
    navigation.select(view(), group.selection, true);
    navigation.select(group, { places: ["shared-office"], organisation: "member" }, false);
    navigation.reset();

    expect(navigation.back()).toBeUndefined();
    expect(navigation.back()).toBeUndefined();
});

/** Create a results view with nondefault camera, padding and scroll values. */
function view(): MapView {
    return {
        camera: {
            center: [8.52, 47.38],
            zoom: 11.75,
            bearing: 12,
            pitch: 20,
            padding: { top: 24, right: 16, bottom: 220, left: 8 },
        },
        selection: { places: [] },
        groupSearch: "",
        scrollTop: 640,
        isOpen: true,
        isExpanded: true,
    };
}
