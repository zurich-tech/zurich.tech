import { filterLocations } from "../src/map/filter";
import { expect, test } from "bun:test";
import { groupLocations, type LocatedOrganisation } from "../convex/places/grouping";
import { arrangeLogos } from "../src/map/placement";
import { overview } from "../src/map/camera";
import { matchingPlaces, placeName, selectPlaces } from "../src/map/places";
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
            padding: { top: 48, right: 24, bottom: 210, left: 24 },
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
            padding: { top: 48, right: 24, bottom: 520, left: 24 },
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
        // shared dots carry their own focus ring rather than a second logo-sized ring
        expect(
            layers.find((layer) => layer.id === "organisations-active")?.layout?.["icon-image"],
        ).toEqual(["case", [">", ["get", "count"], 1], "logo-space", "ring-active"]);
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
                      }
                    : {
                          id: "single",
                          place: place.id,
                          name: "single",
                          badge: "badge:single",
                          count: 1,
                          isLogo: false,
                      },
        })),
    });
    expect([...properties.keys()]).toEqual([
        "organisations:text-offset",
        "organisations-active:text-offset",
    ]);
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
            "all",
            ["any", ["!", ["get", "isLogo"]], [">", ["get", "count"], 1]],
            [
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
            ],
        ]);
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
            office("initial"),
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
    } finally {
        if (originalImage) Object.defineProperty(globalThis, "Image", originalImage);
        else Reflect.deleteProperty(globalThis, "Image");
        if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
        else Reflect.deleteProperty(globalThis, "document");
    }
});

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

test("separate logos stay put and overlapping logos retain individual anchors", () => {
    const logos = [
        { id: "one", x: 100, y: 100, size: 26 },
        { id: "two", x: 132, y: 100, size: 26 },
    ];
    expect(
        arrangeLogos(logos, { width: 800, height: 600 }).placed.map((logo) => logo.offset),
    ).toEqual([
        [0, 0],
        [0, 0],
    ]);
    const shared = arrangeLogos([...logos, { id: "three", x: 100, y: 100, size: 36 }], {
        width: 800,
        height: 600,
    }).placed;
    expect(shared).toHaveLength(3);
    expect(shared[2].x).toBe(100);
    for (let index = 0; index < shared.length; index++) {
        for (const other of shared.slice(index + 1)) {
            const logo = shared[index];
            expect(
                Math.hypot(
                    logo.x + logo.offset[0] - other.x - other.offset[0],
                    logo.y + logo.offset[1] - other.y - other.offset[1],
                ),
            ).toBeGreaterThanOrEqual((logo.size + other.size) / 2 + 3);
        }
    }
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

test("test_reserve_anchored_groups_when_placing_standalone_sponsors", () => {
    const group = { id: "group", x: 100, y: 100, size: 36 };
    const sponsor = { id: "sponsor", x: 100, y: 100, size: 36 };
    const result = arrangeLogos([sponsor], { width: 390, height: 474 }, [group]);
    expect(result.crowded).toEqual([]);
    expect(result.placed).toHaveLength(1);
    const placed = result.placed[0];
    expect(Math.hypot(placed.offset[0], placed.offset[1])).toBeGreaterThanOrEqual(39);
    expect(group).toEqual({ id: "group", x: 100, y: 100, size: 36 });
});

test("dense edge placement stays within bounds and accounts for every visible organisation", () => {
    const input = Array.from({ length: 200 }, (_, index) => ({
        id: String(index),
        x: 10,
        y: 10,
        size: index % 2 ? 26 : 36,
    }));
    const result = arrangeLogos(input, { width: 390, height: 474 });
    expect(result.placed.length + result.crowded.length).toBe(200);
    expect(result.crowded.length).toBeGreaterThan(0);
    for (const [index, logo] of result.placed.entries()) {
        const x = logo.x + logo.offset[0];
        const y = logo.y + logo.offset[1];
        expect(x - logo.size / 2).toBeGreaterThanOrEqual(0);
        expect(y - logo.size / 2).toBeGreaterThanOrEqual(0);
        expect(x + logo.size / 2).toBeLessThanOrEqual(390);
        expect(y + logo.size / 2).toBeLessThanOrEqual(474);
        for (const other of result.placed.slice(index + 1)) {
            expect(
                Math.hypot(x - other.x - other.offset[0], y - other.y - other.offset[1]),
            ).toBeGreaterThanOrEqual((logo.size + other.size) / 2 + 3);
        }
    }
    expect(
        arrangeLogos([{ id: "offscreen", x: -100, y: 100, size: 36 }], { width: 390, height: 474 }),
    ).toEqual({ placed: [], crowded: [] });
});
