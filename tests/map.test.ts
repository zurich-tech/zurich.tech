import { filterLocations } from "../src/map/filter";
import { expect, test } from "bun:test";
import { groupLocations, type LocatedOrganisation } from "../convex/places/grouping";
import { overview } from "../src/map/camera";
import {
    countOrganisations,
    mapCount,
    stackOrganisations,
    matchingPlaces,
    organisationCountLabel,
    placeName,
    selectPlaces,
} from "../src/map/places";
import { searchTerms } from "../src/search/search";
import {
    addBadges,
    addOrganisationLayers,
    highlightOrganisations,
    showOrganisations,
} from "../src/map/layers";
import { cornerColour } from "../src/map/colour";
import { isPreviewPath } from "../src/map/hover";
import type { Map as GeographicMap, SymbolLayerSpecification } from "maplibre-gl";

test("test_label_zero_single_and_multiple_organisation_counts", () => {
    expect([0, 1, 2, 996].map(organisationCountLabel)).toEqual([
        "0 organisations",
        "1 organisation",
        "2 organisations",
        "996 organisations",
    ]);
});

test("test_compact_visible_and_filtered_counts_without_duplicate_totals", () => {
    expect(
        [
            [0, 0],
            [1, 1],
            [1656, 1656],
            [1147, 1656],
            [0, 12],
        ].map(([visible, total]) => mapCount(visible, total)),
    ).toEqual(["0", "1", "1,656", "1,147 / 1,656", "0 / 12"]);
});

test("test_rank_three_shared_address_logos_without_mutating_the_directory", () => {
    const entries = [
        { ...office("Zeta"), logoUrl: "https://example.com/z.png" },
        { ...office("Host"), recognition: "Host", logoUrl: "https://example.com/h.png" },
        {
            ...office("Sponsor"),
            isSponsor: true,
            recognition: "Gold sponsor",
            logoUrl: "https://example.com/s.png",
        },
        { ...office("Alpha"), logoUrl: "https://example.com/a.png" },
        office("No logo"),
    ];
    const place = groupLocations(entries)[0];
    const original = place.organisations.map((person) => person.name);
    expect(stackOrganisations(place).map((person) => person.name)).toEqual([
        "Sponsor",
        "Host",
        "Alpha",
    ]);
    expect(place.organisations.map((person) => person.name)).toEqual(original);
});

test("test_reuse_unfiltered_locations_for_empty_and_whitespace_searches", () => {
    const locations = groupLocations([office("first"), office("second")]);
    for (const query of ["", " ", "  \t  "]) {
        expect(filterLocations(locations, "all", searchTerms(query))).toBe(locations);
    }

    // an unknown selected topic must still narrow to no results, never use the fast path
    expect(filterLocations(locations, "all", [], new Set())).toEqual([]);
});

test("test_reject_an_organisation_excluded_by_search_at_a_shared_address", () => {
    const locations = groupLocations([office("first"), office("second")]);
    const filtered = filterLocations(locations, "all", ["second"]);
    const ids = [locations[0].id];

    // the address still matches, but the previously clicked organisation no longer does
    expect(selectPlaces(filtered, ids, "first")).toEqual([]);
    expect(selectPlaces(filtered, ids, "second")).toEqual(filtered);
});

test("test_count_organisations_once_across_offices_and_filtered_views", () => {
    // retain separate offices while counting the same organisation only once
    const locations = groupLocations([
        office("first"),
        { ...office("first", "Other street 1"), latitude: 47.4 },
        office("second"),
    ]);

    expect(locations).toHaveLength(2);
    expect(countOrganisations(locations)).toBe(2);
    expect(countOrganisations(filterLocations(locations, "all", ["first"]))).toBe(1);
    expect(countOrganisations(locations.filter((place) => place.latitude === 47.4))).toBe(1);
    expect(countOrganisations([])).toBe(0);
});

test("test_frame_initial_and_reset_views_with_the_same_viewport_geometry", () => {
    expect(overview(false, 1200, 800, false)).toEqual({
        bounds: [
            [8.44, 47.32],
            [8.64, 47.44],
        ],
        fitBoundsOptions: {
            padding: { top: 64, right: 64, bottom: 64, left: 400 },
            duration: 0,
            maxZoom: 12,
        },
    });
    expect(overview(false, 390, 800, false)).toEqual({
        bounds: [
            [8.44, 47.32],
            [8.64, 47.44],
        ],
        fitBoundsOptions: {
            padding: { top: 48, right: 24, bottom: 180, left: 24 },
            duration: 0,
            maxZoom: 12,
        },
    });
    expect(overview(false, 390, 800, true)).toEqual({
        bounds: [
            [8.44, 47.32],
            [8.64, 47.44],
        ],
        fitBoundsOptions: {
            padding: { top: 48, right: 24, bottom: 480, left: 24 },
            duration: 0,
            maxZoom: 12,
        },
    });
    expect(overview(true, 390, 800, true)).toEqual({
        bounds: [
            [8.4, 47.3],
            [8.68, 47.46],
        ],
        fitBoundsOptions: { padding: 0, duration: 0, maxZoom: 18 },
    });
    // reserve the side panel rather than a bottom sheet on landscape phones
    expect(overview(false, 740, 338, true).fitBoundsOptions.padding).toEqual({
        top: 24,
        right: 60,
        bottom: 24,
        left: 376,
    });
});

test("test_leave_visible_map_area_on_short_and_narrow_screens", () => {
    for (const width of [32, 320, 390, 800, 844, 1200]) {
        for (const height of [32, 160, 240, 390, 800]) {
            for (const isPanelOpen of [false, true]) {
                const padding = overview(false, width, height, isPanelOpen).fitBoundsOptions
                    .padding;
                if (!padding || typeof padding !== "object")
                    throw new Error("Expected explicit map padding");

                expect(padding.left! + padding.right!).toBeLessThan(width);
                expect(padding.top! + padding.bottom!).toBeLessThan(height);
            }
        }
    }
});

test("test_respect_label_collisions_for_active_markers", () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const originalImageData = Object.getOwnPropertyDescriptor(globalThis, "ImageData");
    const layers: SymbolLayerSpecification[] = [];
    const context = {
        beginPath() {},
        arc() {},
        roundRect() {},
        fill() {},
        stroke() {},
        getImageData: () => ({ width: 80, height: 80, data: new Uint8ClampedArray(80 * 80 * 4) }),
    };
    const map = {
        addSource() {},
        addImage() {},
        addLayer: (layer: SymbolLayerSpecification) => layers.push(layer),
    } as unknown as GeographicMap;

    // exercise the real layer definitions without requiring a browser or WebGL
    try {
        Object.defineProperty(globalThis, "document", {
            configurable: true,
            value: { createElement: () => ({ getContext: () => context }) },
        });
        Object.defineProperty(globalThis, "ImageData", { configurable: true, value: class {} });
        addOrganisationLayers(map, true);
        expect(
            layers.map((layer) => ({
                id: layer.id,
                overlap: layer.layout?.["text-allow-overlap"] ?? false,
                optional: layer.layout?.["text-optional"],
                offset: layer.layout?.["icon-offset"] ?? [0, 0],
            })),
        ).toEqual([
            { id: "organisation-dots", overlap: false, optional: true, offset: [0, 0] },
            { id: "organisations", overlap: false, optional: true, offset: [0, 0] },
            { id: "organisations-active", overlap: false, optional: true, offset: [0, 0] },
        ]);
        // the source selects a visible ring for ordinary badges, sponsors and shared dots
        expect(
            layers.find((layer) => layer.id === "organisations-active")?.layout?.["icon-image"],
        ).toEqual([
            "step",
            ["zoom"],
            ["get", "ring"],
            14,
            [
                "case",
                [
                    "all",
                    [">", ["get", "count"], 1],
                    ["!", ["get", "isSponsor"]],
                    ["!=", ["get", "badge"], "group-dot"],
                ],
                "ring-stack",
                ["get", "ring"],
            ],
        ]);
    } finally {
        if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
        else Reflect.deleteProperty(globalThis, "document");
        if (originalImageData) Object.defineProperty(globalThis, "ImageData", originalImageData);
        else Reflect.deleteProperty(globalThis, "ImageData");
    }
});

test("test_protect_diagonal_preview_approaches_in_every_direction", () => {
    const card = { left: 100, right: 300, top: 100, bottom: 200 };
    for (const origin of [
        { x: 200, y: 250 },
        { x: 200, y: 50 },
        { x: 50, y: 150 },
        { x: 350, y: 150 },
    ]) {
        for (const destination of [
            { x: 100, y: 100 },
            { x: 300, y: 200 },
        ]) {
            for (let step = 0; step <= 10; step++) {
                const point = {
                    x: origin.x + ((destination.x - origin.x) * step) / 10,
                    y: origin.y + ((destination.y - origin.y) * step) / 10,
                };
                expect(isPreviewPath(point, origin, card)).toBe(true);
            }
        }
        expect(isPreviewPath({ x: 0, y: 0 }, origin, card)).toBe(false);
        expect(isPreviewPath({ x: 400, y: 300 }, origin, card)).toBe(false);
    }
});

test("test_match_solid_logo_backgrounds_without_recolouring_transparent_or_varied_artwork", () => {
    const sample = (colours: number[][]) =>
        ({ width: 2, height: 2, data: new Uint8ClampedArray(colours.flat()) }) as ImageData;
    expect(cornerColour(sample(Array(4).fill([20, 30, 40, 255])))).toBe("rgb(20, 30, 40)");
    expect(cornerColour(sample(Array(4).fill([0, 0, 0, 0])))).toBe("#ffffff");
    expect(
        cornerColour(
            sample([
                [20, 30, 40, 255],
                [22, 32, 42, 255],
                [20, 30, 40, 255],
                [22, 32, 42, 255],
            ]),
        ),
    ).toBe("rgb(21, 31, 41)");
    expect(
        cornerColour(
            sample([
                [0, 0, 0, 255],
                [255, 255, 255, 255],
                [0, 0, 0, 255],
                [255, 255, 255, 255],
            ]),
        ),
    ).toBe("#ffffff");
});

test("test_keep_large_shared_addresses_as_one_anchored_marker", () => {
    const properties = new Map<string, unknown>();
    let source: unknown;
    const map = {
        getSource: () => ({ setData: (value: typeof source) => (source = value) }),
        getLayer: () => true,
        setLayoutProperty: (layer: string, property: string, value: unknown) =>
            properties.set(`${layer}:${property}`, value),
    } as unknown as GeographicMap;
    const places = groupLocations([
        ...Array.from({ length: 75 }, (_, index) => office(`tenant-${index}`)),
        { ...office("host"), kind: "space", prominence: "large", isSponsor: true },
        office("single", "Baslerstrasse 79"),
    ]);
    showOrganisations(map, places, () => false);

    // retain the entire group at the real address, alongside an ordinary standalone logo
    expect(source).toEqual({
        type: "FeatureCollection",
        features: places.map((place) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [8.5, 47.38] },
            properties:
                place.organisations.length > 1
                    ? {
                          id: place.id,
                          place: place.id,
                          name: "host",
                          badge: "badge:host",
                          count: 76,
                          isLogo: true,
                          isSponsor: true,
                          labelOffset: [28 / 12, 0],
                          ring: "ring:48:true",
                      }
                    : {
                          id: "single",
                          place: place.id,
                          name: "single",
                          badge: "badge:single",
                          count: 1,
                          isLogo: false,
                          isSponsor: false,
                          labelOffset: [20 / 12, 0],
                          ring: "ring-active",
                      },
        })),
    });
    // layout is fixed at layer creation rather than mutated on source upload
    expect([...properties.keys()]).toEqual([]);
});

test("test_preserve_complete_groups_after_search_and_category_filters", () => {
    const places = groupLocations([
        { ...office("host"), kind: "space", prominence: "large", isSponsor: true },
        { ...office("startup"), kind: "startup" },
        office("neighbour", "Baslerstrasse 79"),
    ]);
    const matches = filterLocations(places, "startup", ["startup"]);
    const groups = matchingPlaces(places, matches);
    expect(groups).toEqual([places[0]]);
    expect(placeName(groups[0])).toBe("host");
    expect(placeName(places[1])).toBe("Shared address");
    expect(filterLocations(groups, "all", ["host"])).toEqual([
        { ...places[0], organisations: [places[0].organisations[0]] },
    ]);
    expect(filterLocations(groups, "all", ["missing"])).toEqual([]);
    expect(matchingPlaces(places, [])).toEqual([]);
});

test("test_name_only_unique_space_hosts_without_inferring_hosts_from_prominence", () => {
    const university = {
        ...office("ETH AI"),
        kind: "university" as const,
        prominence: "large" as const,
    };
    const space = { ...office("Technopark Zürich"), kind: "space" as const };
    const cases = [
        { members: [university, office("Akina")], name: "Shared address" },
        { members: [university, space, office("Akina")], name: "Technopark Zürich" },
        {
            members: [space, { ...office("Other space"), kind: "space" as const }],
            name: "Shared address",
        },
    ];
    for (const { members, name } of cases) {
        expect(placeName(groupLocations(members)[0])).toBe(name);
        expect(placeName(groupLocations([...members].reverse())[0])).toBe(name);
    }
});

test("test_search_complete_selected_groups_independently_of_directory_matches", () => {
    const places = groupLocations([
        { ...office("Technopark Zürich"), kind: "space" },
        { ...office("Akina"), kind: "startup" },
        office("Neighbour", "Baslerstrasse 79"),
    ]);
    const directoryTerms = searchTerms("Technopark");
    const matches = filterLocations(places, "space", directoryTerms);
    const markers = matchingPlaces(places, matches);
    const selected = selectPlaces(places, [markers[0].id]);

    // a local query can find a tenant excluded by the directory query and category
    expect(selected).toEqual([places[0]]);
    expect(filterLocations(selected, "all", searchTerms("  Ákina AKINA "))).toEqual([
        {
            ...places[0],
            organisations: places[0].organisations.filter((person) => person.id === "Akina"),
        },
    ]);
    expect(filterLocations(selected, "all", searchTerms("missing"))).toEqual([]);
    expect(filterLocations(selected, "all", searchTerms(""))).toEqual(selected);
    expect(filterLocations(places, "space", directoryTerms)).toEqual(matches);
    expect(matchingPlaces(places, matches)).toEqual(markers);

    // selecting a filtered-out tenant must not turn its address into an empty group
    expect(selectPlaces(places, [markers[0].id], "Akina")).toEqual([
        {
            ...places[0],
            organisations: places[0].organisations.filter((person) => person.id === "Akina"),
        },
    ]);
    expect(selectPlaces(places, [markers[0].id], "removed")).toEqual([]);
});

test("test_highlight_shared_addresses_from_any_member_and_clear_stale_highlights", () => {
    const places = groupLocations([
        office("first"),
        office("second"),
        office("single", "Baslerstrasse 79"),
    ]);
    let filter: unknown;
    const map = {
        setFilter: (layer: string, value: unknown) => {
            expect(layer).toBe("organisations-active");
            filter = value;
        },
    } as unknown as GeographicMap;

    for (const ids of [["first"], ["second"], ["first", "second", "single"], []]) {
        highlightOrganisations(map, places, ids);
        expect(filter).toEqual([
            "in",
            ["get", "place"],
            [
                "literal",
                ids.length === 3
                    ? places.map((place) => place.id)
                    : ids.length
                      ? [places[0].id]
                      : [],
            ],
        ]);
    }
});

test("test_draw_equal_initials_once_without_merging_organisation_image_ids", async () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const drawn: string[] = [];
    const images = new Map<string, { initial: string }>();
    let initial = "";
    const context = {
        beginPath() {},
        arc() {},
        fill() {},
        fillText(value: string) {
            initial = value;
            drawn.push(value);
        },
        getImageData: () => ({ initial }),
    };
    const map = {
        hasImage: (id: string) => images.has(id),
        addImage: (id: string, image: { initial: string }) => images.set(id, image),
    } as unknown as GeographicMap;

    try {
        Object.defineProperty(globalThis, "document", {
            configurable: true,
            value: { createElement: () => ({ getContext: () => context }) },
        });
        const locations = groupLocations(
            Array.from({ length: 1000 }, (_, index) => ({
                ...office(`initial-${index}`, `Baslerstrasse ${String(index).padStart(4, "0")}`),
                name: index % 2 ? "Beta" : "alpha",
            })),
        );
        await addBadges(map, locations, () => true);
        await addBadges(map, locations, () => true);

        expect(drawn).toEqual(["A", "B"]);
        expect(images).toEqual(
            new Map(
                Array.from({ length: 1000 }, (_, index) => [
                    `badge:initial-${index}`,
                    { initial: index % 2 ? "B" : "A" },
                ]),
            ),
        );
    } finally {
        if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
        else Reflect.deleteProperty(globalThis, "document");
    }
});

test("test_load_external_badges_with_anonymous_cors_before_assigning_source", async () => {
    // model the browser's canvas restriction when an image was not requested with CORS
    const originalImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const requests: string[][] = [];
    const decodes: (() => void)[] = [];
    const pixels = { width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4) };
    class BadgeImage {
        crossOrigin = "";
        width = 32;
        height = 32;
        set src(source: string) {
            requests.push([this.crossOrigin, source]);
        }
        decode() {
            return new Promise<void>((resolve) => decodes.push(resolve));
        }
    }
    const context = {
        beginPath() {},
        arc() {},
        fill() {},
        save() {},
        clip() {},
        restore() {},
        fillText() {},
        drawImage(image: BadgeImage) {
            if (image.crossOrigin !== "anonymous") throw new Error("Canvas is tainted");
        },
        getImageData: () => pixels,
    };
    const images = new Map<string, unknown>();
    const updates: string[] = [];
    const map = {
        hasImage: (id: string) => images.has(id),
        addImage: (id: string, image: unknown) => images.set(id, image),
        updateImage: (id: string, image: unknown) => {
            updates.push(id);
            images.set(id, image);
        },
    } as unknown as GeographicMap;

    // exercise the public badge loading path and restore browser globals afterwards
    try {
        Object.defineProperty(globalThis, "Image", { configurable: true, value: BadgeImage });
        Object.defineProperty(globalThis, "document", {
            configurable: true,
            value: { createElement: () => ({ getContext: () => context }) },
        });
        const places = groupLocations([
            { ...office("external"), logoUrl: "https://logos.example/logo.png" },
            office("initial", "Baslerstrasse 79"),
        ]);
        const loading = addBadges(map, places, () => true);
        // every marker is available before the pending image has downloaded
        expect([...images.keys()]).toEqual(["badge:external", "badge:initial"]);
        expect(updates).toEqual([]);
        decodes.shift()!();
        await loading;
        await addBadges(map, places, () => true);
        expect(requests).toEqual([["anonymous", "https://logos.example/logo.png"]]);
        expect([...images].sort(([left], [right]) => left.localeCompare(right))).toEqual([
            ["badge:external", pixels],
            ["badge:initial", pixels],
        ]);
        expect(updates).toEqual(["badge:external"]);

        // navigation must stop a pending logo from touching the disposed map
        let isActive = true;
        const pending = addBadges(
            map,
            groupLocations([
                { ...office("disposed"), logoUrl: "https://logos.example/pending.png" },
            ]),
            () => isActive,
        );
        isActive = false;
        decodes.shift()!();
        await pending;
        expect(updates).toEqual(["badge:external"]);

        // cap concurrent downloads and stop queued requests after navigation
        isActive = true;
        const before = requests.length;
        const bounded = addBadges(
            map,
            groupLocations(
                Array.from({ length: 20 }, (_, index) => ({
                    ...office(`bounded-${index}`, `Baslerstrasse ${index}`),
                    logoUrl: `https://logos.example/${index}.png`,
                })),
            ),
            () => isActive,
        );
        expect(requests.length - before).toBe(6);
        isActive = false;
        for (const resolve of decodes.splice(0)) resolve();
        await bounded;
        expect(requests.length - before).toBe(6);
        expect(updates).toEqual(["badge:external"]);
    } finally {
        if (originalImage) Object.defineProperty(globalThis, "Image", originalImage);
        else Reflect.deleteProperty(globalThis, "Image");
        if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
        else Reflect.deleteProperty(globalThis, "document");
    }
});

test.each([
    ["normal", 1, 0, 1, []],
    ["recovered", 2, 1, 1, []],
    ["remote", 1, 0, 0, ["decode failed"]],
    ["nonmatching", 1, 0, 0, ["decode failed"]],
    ["http", 1, 1, 0, ["Map icon reload failed: HTTP 503"]],
    ["network", 1, 1, 0, ["reload failed"]],
    ["body", 1, 1, 0, ["body failed"]],
    ["retry", 2, 1, 0, ["decode failed"]],
    ["cancel-initial", 1, 0, 0, []],
    ["cancel-reload", 1, 1, 0, []],
    ["cancel-retry", 2, 1, 0, []],
] as const)(
    "test_bound_hosted_badge_recovery_%s",
    async (scenario, decodes, reloads, upgrades, errors) => {
        const originals = ["Image", "document", "fetch"].map(
            (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
        );
        const originalError = console.error;
        const hosted = `https://media.zurich.tech/organisations/example/${"a".repeat(64)}.png`;
        const source =
            scenario === "remote"
                ? "https://remote.example/logo.png"
                : scenario === "nonmatching"
                  ? `${hosted}?version=1`
                  : hosted;
        const requests: string[][] = [];
        const fetches: [string, RequestInit][] = [];
        const failures: [string, string][] = [];
        const updates: string[] = [];
        let isActive = true;
        let decoded = 0;
        let consumed = false;
        class BadgeImage {
            crossOrigin = "";
            width = 32;
            height = 32;
            set src(value: string) {
                requests.push([this.crossOrigin, value]);
            }
            async decode() {
                decoded++;
                if (scenario === "normal") return;
                if (decoded === 1) {
                    if (scenario === "cancel-initial") isActive = false;
                    throw new Error("decode failed");
                }
                expect(consumed).toBe(true);
                if (scenario === "cancel-retry") isActive = false;
                if (scenario === "retry") throw new Error("decode failed");
            }
        }
        const pixels = { width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4) };
        const context = {
            beginPath() {},
            arc() {},
            fill() {},
            save() {},
            clip() {},
            restore() {},
            fillText() {},
            drawImage() {},
            getImageData: () => pixels,
        };
        const images = new Map<string, unknown>();
        const map = {
            hasImage: (id: string) => images.has(id),
            addImage: (id: string, image: unknown) => images.set(id, image),
            updateImage: (id: string) => updates.push(id),
        } as unknown as GeographicMap;

        // exercise recovery through the public badge path, including disposal during awaited work
        try {
            Object.defineProperty(globalThis, "Image", { configurable: true, value: BadgeImage });
            Object.defineProperty(globalThis, "document", {
                configurable: true,
                value: { createElement: () => ({ getContext: () => context }) },
            });
            Object.defineProperty(globalThis, "fetch", {
                configurable: true,
                value: async (url: string, options: RequestInit) => {
                    fetches.push([url, options]);
                    if (scenario === "network") throw new Error("reload failed");
                    return {
                        ok: scenario !== "http",
                        status: scenario === "http" ? 503 : 200,
                        async arrayBuffer() {
                            if (scenario === "body") throw new Error("body failed");
                            if (scenario === "cancel-reload") isActive = false;
                            consumed = true;
                            return new ArrayBuffer(0);
                        },
                    };
                },
            });
            console.error = (message, error: Error) => failures.push([message, error.message]);
            const places = groupLocations([{ ...office("recover"), mapLogoUrl: source }]);
            await addBadges(map, places, () => isActive);
            await addBadges(map, places, () => isActive);

            // retain initials on final failure, never repeat recovery for an already registered badge
            expect(requests).toEqual(Array.from({ length: decodes }, () => ["anonymous", source]));
            expect(fetches).toEqual(
                Array.from({ length: reloads }, () => [
                    source,
                    {
                        mode: "cors",
                        credentials: "omit",
                        cache: "reload",
                    },
                ]),
            );
            expect(updates).toEqual(Array.from({ length: upgrades }, () => "badge:recover"));
            expect([...images.keys()]).toEqual(["badge:recover"]);
            expect(failures).toEqual(
                errors.map((error) => [`Map icon failed to load: ${source}`, error]),
            );
        } finally {
            console.error = originalError;
            for (const [name, original] of originals) {
                if (original) Object.defineProperty(globalThis, name, original);
                else Reflect.deleteProperty(globalThis, name);
            }
        }
    },
);

/** Create a public office record for grouping scenarios. */
function office(id: string, line1 = "Baslerstrasse 77"): LocatedOrganisation {
    return {
        id,
        name: id,
        kind: "company",
        slug: id,
        location: "Office",
        prominence: "small",
        latitude: 47.38,
        longitude: 8.5,
        address: { line1, postalCode: "8048", locality: "Zurich", countryCode: "CH" },
    };
}

test("shared offices merge independent address documents and retain every organisation", () => {
    const host = { ...office("host"), prominence: "large" as const };
    host.address.locality = "Zürich";
    const groups = groupLocations([
        office("startup", "  baslerstrasse   77 "),
        host,
        office("startup"),
        office("neighbour", "Baslerstrasse 79"),
    ]);
    expect(groups).toHaveLength(2);
    const shared = groups.find((group) => group.organisations.length === 2)!;
    expect(shared.organisations.map((organisation) => organisation.id)).toEqual([
        "host",
        "startup",
    ]);
    expect(shared.longitude).toBe(8.5);
});

test("shared-address filters match category and search on the same organisation", () => {
    const locations = groupLocations([
        { ...office("zurich.tech"), kind: "community" },
        { ...office("Symbol"), kind: "startup" },
    ]);
    expect(filterLocations(locations, "startup", ["zurich.tech"])).toEqual([]);
    const startups = filterLocations(locations, "startup", []);
    expect(startups[0].organisations.map((entry) => entry.name)).toEqual(["Symbol"]);
    expect(filterLocations(locations, "all", ["baslerstrasse"])[0].organisations).toHaveLength(2);
});
