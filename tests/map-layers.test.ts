import { afterEach, beforeEach, expect, test } from "bun:test";
import { createExpression, validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type {
    Map as GeographicMap,
    SourceSpecification,
    SymbolLayerSpecification,
} from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { groupLocations, type LocatedOrganisation } from "../convex/places/grouping";
import {
    addBadges,
    addOrganisationLayers,
    filterOrganisations,
    highlightOrganisations,
    showOrganisations,
} from "../src/map/layers";

/** Browser globals restored after each isolated canvas exercise. */
let originals: Map<string, PropertyDescriptor | undefined>;

beforeEach(() => {
    originals = new Map(
        ["document", "Image"].map((name) => [
            name,
            Object.getOwnPropertyDescriptor(globalThis, name),
        ]),
    );
    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
            createElement: () => {
                const canvas = { width: 0, height: 0, getContext: () => context };
                const shapes: string[] = [];
                const context = {
                    beginPath() {},
                    arc() {
                        shapes.push("round");
                    },
                    roundRect() {
                        shapes.push("square");
                    },
                    fill() {},
                    stroke() {},
                    fillText() {},
                    save() {},
                    clip() {},
                    restore() {},
                    drawImage() {},
                    getImageData: () => ({
                        width: canvas.width,
                        height: canvas.height,
                        shapes: [...shapes],
                        data: new Uint8ClampedArray(canvas.width * canvas.height * 4),
                    }),
                };

                return canvas;
            },
        },
    });
});

afterEach(() => {
    for (const [name, original] of originals) {
        if (original) Object.defineProperty(globalThis, name, original);
        else Reflect.deleteProperty(globalThis, name);
    }
});

/** Build an address-distinct public organisation unless a shared street is requested. */
function office(id: string, street = id): LocatedOrganisation {
    return {
        id,
        name: id,
        slug: id,
        kind: "company",
        prominence: "small",
        location: "Office",
        latitude: 47.38,
        longitude: 8.5,
        address: { line1: street, locality: "Zurich", countryCode: "CH" },
    };
}

/** Capture the complete map API effects without WebGL. */
function mockMap() {
    const sources: Record<string, SourceSpecification> = {};
    const layers: SymbolLayerSpecification[] = [];
    const uploads: FeatureCollection<Point>[] = [];
    const filters: [string, unknown][] = [];
    const images = new Map<string, { width: number; height: number; shapes: string[] }>();
    const updates: string[] = [];
    const map = {
        addSource: (id: string, source: SourceSpecification) => {
            sources[id] = source;
        },
        getSource: () => ({
            setData: (value: FeatureCollection<Point>) => uploads.push(value),
        }),
        addLayer: (layer: SymbolLayerSpecification) => layers.push(layer),
        getLayer: (id: string) => layers.find((layer) => layer.id === id),
        setFilter: (id: string, filter: unknown) => filters.push([id, filter]),
        hasImage: (id: string) => images.has(id),
        addImage: (id: string, image: { width: number; height: number; shapes: string[] }) =>
            images.set(id, image),
        updateImage: (id: string) => updates.push(id),
    } as unknown as GeographicMap;

    return { map, sources, layers, uploads, filters, images, updates };
}

/** Evaluate the actual MapLibre expression, failing loudly on invalid syntax. */
function evaluate(expression: unknown, properties: Record<string, unknown>, zoom = 10) {
    if (!Array.isArray(expression)) return expression;
    const compiled = createExpression(expression, "layers.organisations.test");
    if (compiled.result === "error") throw new Error(JSON.stringify(compiled.value));

    return compiled.value.evaluate({ zoom }, { type: 1, properties });
}

test("test_filter_exact_addresses_without_source_uploads_or_active_selection_changes", () => {
    const mock = mockMap();
    addOrganisationLayers(mock.map, true);
    const places = groupLocations([
        office("first", "shared"),
        office("second", "shared"),
        office("separate"),
    ]);
    showOrganisations(mock.map, places, () => false);
    const source = structuredClone(mock.uploads[0]);
    const shared = places.find((place) => place.organisations.length === 2)!;

    // narrow to a tenant while preserving the complete source group and exact literal address id
    for (const selected of [
        [{ ...shared, organisations: [shared.organisations[1]] }],
        [],
        places,
    ]) {
        mock.filters.length = 0;
        filterOrganisations(mock.map, selected);
        const selection = ["in", ["get", "place"], ["literal", selected.map((place) => place.id)]];
        expect(mock.filters).toEqual([
            ["organisations", selection],
            [
                "organisation-dots",
                ["all", ["all", ["==", ["get", "count"], 1], ["!", ["get", "isLogo"]]], selection],
            ],
        ]);
        expect(mock.uploads).toEqual([source]);
        expect(
            source.features
                .filter((feature) => evaluate(selection, feature.properties!))
                .map((feature) => feature.properties!.place),
        ).toEqual(
            places
                .filter((place) => selected.some((match) => match.id === place.id))
                .map((place) => place.id),
        );
    }
    expect(
        source.features.find((feature) => feature.properties!.place === shared.id)?.properties,
    ).toEqual({
        id: shared.id,
        place: shared.id,
        name: "Shared address",
        badge: "group-dot",
        count: 2,
        isLogo: false,
        labelOffset: [16 / 12, 0],
        ring: "ring-group",
    });

    // a real full-data change still replaces the source explicitly
    showOrganisations(mock.map, places.slice(1), () => false);
    expect(mock.uploads).toHaveLength(2);
});

test.each([true, false])(
    "test_validate_canvas_layers_sizes_visibility_and_order_labelled_%s",
    (isLabelled) => {
        const mock = mockMap();
        addOrganisationLayers(mock.map, isLabelled);
        expect(
            validateStyleMin({
                version: 8,
                glyphs: "https://example.com/{fontstack}/{range}.pbf",
                sources: mock.sources,
                layers: mock.layers,
            }),
        ).toEqual([]);
        const layer = mock.layers.find((layer) => layer.id === "organisations")!;
        const active = mock.layers.find((layer) => layer.id === "organisations-active")!;
        expect(layer.layout?.["symbol-z-order"]).toBe("source");
        expect(layer.layout?.["icon-allow-overlap"]).toBe(true);
        expect(active.layout?.["text-offset"]).toEqual(layer.layout?.["text-offset"]);
        expect(mock.images.get("group-dot")).toMatchObject({ width: 48, height: 48 });
        expect(mock.images.get("ring-group")).toMatchObject({ width: 64, height: 64 });

        for (const zoom of [0, 10, 12, 13, 18]) {
            for (const properties of [
                {
                    count: 2,
                    isLogo: false,
                    badge: "group-dot",
                    ring: "ring-group",
                    labelOffset: [16 / 12, 0],
                },
                {
                    count: 1,
                    isLogo: true,
                    badge: "badge:sponsor",
                    ring: "ring:36:true",
                    labelOffset: [22 / 12, 0],
                },
            ]) {
                expect(evaluate(layer.layout?.["icon-image"], properties, zoom)).toBe(
                    properties.badge,
                );
                expect(evaluate(layer.layout?.["icon-size"], properties, zoom)).toBe(1);
                expect(evaluate(layer.paint?.["icon-opacity"], properties, zoom)).toBe(1);
                expect(evaluate(active.layout?.["icon-image"], properties, zoom)).toBe(
                    properties.ring,
                );
                expect(evaluate(active.layout?.["icon-size"], properties, zoom)).toBe(1);
                expect(evaluate(layer.layout?.["text-offset"], properties, zoom)).toEqual(
                    properties.labelOffset,
                );
            }
        }
        expect(
            [
                { count: 1, isLogo: false },
                { count: 2, isLogo: false },
                { count: 1, isLogo: true },
            ].map((properties) => evaluate(layer.layout?.["symbol-sort-key"], properties)),
        ).toEqual([0, 1, 2]);
        if (!isLabelled) {
            expect(evaluate(layer.layout?.["icon-image"], { count: 1, isLogo: false })).toBe(
                "organisation-dot",
            );
            filterOrganisations(mock.map, []);
            expect(mock.filters).toEqual([
                ["organisations", ["in", ["get", "place"], ["literal", []]]],
            ]);
        }
    },
);

test("test_draw_only_single_place_badges_with_sponsor_shapes_and_prominence_sizes", async () => {
    const mock = mockMap();
    const places = groupLocations([
        office("tenant-a", "shared"),
        office("tenant-b", "shared"),
        office("ordinary"),
        ...(["large", "medium", "small"] as const).flatMap((prominence) => [
            {
                ...office(`sponsor-${prominence}`),
                prominence,
                isSponsor: true,
                recognition: "Sponsor",
            },
            { ...office(`host-${prominence}`), prominence, recognition: "Host" },
        ]),
    ]);
    await addBadges(mock.map, places, () => true);
    showOrganisations(mock.map, places, (organisation) => Boolean(organisation.recognition));
    expect([...mock.images.keys()].sort()).toEqual([
        "badge:host-large",
        "badge:host-medium",
        "badge:host-small",
        "badge:ordinary",
        "badge:sponsor-large",
        "badge:sponsor-medium",
        "badge:sponsor-small",
    ]);
    for (const [prominence, size] of [
        ["large", 36],
        ["medium", 30],
        ["small", 26],
    ] as const) {
        expect(mock.images.get(`badge:sponsor-${prominence}`)).toMatchObject({
            width: size * 2,
            height: size * 2,
            shapes: ["square", "square"],
        });
        expect(mock.images.get(`badge:host-${prominence}`)).toMatchObject({
            width: size * 2,
            height: size * 2,
            shapes: ["round", "round"],
        });
        expect(
            mock.uploads[0].features.find(
                (feature) => feature.properties!.id === `sponsor-${prominence}`,
            )?.properties?.ring,
        ).toBe(`ring:${size}:true`);
    }
});

test("test_select_filtered_addresses_including_sponsors_and_groups_without_stale_rings", () => {
    const mock = mockMap();
    const places = groupLocations([
        office("a", "shared"),
        office("b", "shared"),
        { ...office("sponsor"), recognition: "Sponsor", isSponsor: true },
    ]);
    const shared = places.find((place) => place.organisations.length === 2)!;
    for (const [visible, ids, addresses] of [
        [places, ["b", "sponsor"], places.map((place) => place.id)],
        [[shared], ["sponsor"], []],
        [[shared], ["a", "b"], [shared.id]],
        [places, [], []],
    ] as const) {
        mock.filters.length = 0;
        highlightOrganisations(mock.map, [...visible], [...ids]);
        expect(mock.filters).toEqual([
            ["organisations-active", ["in", ["get", "place"], ["literal", addresses]]],
        ]);
    }
});

test("test_filtering_does_not_cancel_or_claim_completion_of_pending_badge_downloads", async () => {
    const mock = mockMap();
    const requests: string[] = [];
    let finish: () => void = () => {
        throw new Error("No pending decode");
    };
    class BadgeImage {
        width = 32;
        height = 32;
        crossOrigin = "";
        set src(value: string) {
            requests.push(value);
        }
        decode() {
            return new Promise<void>((resolve) => {
                finish = resolve;
            });
        }
    }
    Object.defineProperty(globalThis, "Image", { configurable: true, value: BadgeImage });
    const places = groupLocations([{ ...office("logo"), logoUrl: "https://example.com/logo.png" }]);
    const loading = addBadges(mock.map, places, () => true);
    for (const selected of [[], places, [], places]) filterOrganisations(mock.map, selected);
    expect(mock.images.has("badge:logo")).toBe(true);
    expect(mock.updates).toEqual([]);
    expect(requests).toEqual(["https://example.com/logo.png"]);
    finish();
    await loading;
    expect(mock.updates).toEqual(["badge:logo"]);
    expect(mock.uploads).toEqual([]);
});
