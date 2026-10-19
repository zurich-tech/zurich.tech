import { afterEach, beforeEach, expect, test } from "bun:test";
import {
    createExpression,
    createPropertyExpression,
    latest,
    type StylePropertySpecification,
    validateStyleMin,
} from "@maplibre/maplibre-gl-style-spec";
import type {
    Map as GeographicMap,
    SourceSpecification,
    SymbolLayerSpecification,
} from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import { groupLocations, type LocatedOrganisation } from "../convex/places/grouping";
import { organisationOrder } from "../src/map/hover";
import {
    addBadges,
    addOrganisationLayers,
    filterOrganisations,
    highlightOrganisations,
    resizeOrganisationLayers,
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
                const fills: string[] = [];
                const rectangles: number[][] = [];
                const context = {
                    fillStyle: "",
                    beginPath() {},
                    arc() {
                        shapes.push("round");
                    },
                    roundRect(...dimensions: number[]) {
                        shapes.push("square");
                        rectangles.push(dimensions);
                    },
                    fill() {
                        fills.push(context.fillStyle);
                    },
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
                        fills: [...fills],
                        rectangles: [...rectangles],
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
    const layouts: [string, string, unknown][] = [];
    const map = {
        addSource: (id: string, source: SourceSpecification) => {
            sources[id] = source;
        },
        getSource: () => ({
            setData: (value: FeatureCollection<Point>) => uploads.push(value),
        }),
        addLayer: (layer: SymbolLayerSpecification) => layers.push(layer),
        getLayer: (id: string) => layers.find((layer) => layer.id === id),
        setLayoutProperty: (id: string, property: string, value: unknown) => {
            layouts.push([id, property, value]);
            const layer = layers.find((layer) => layer.id === id)!;
            Object.assign(layer.layout!, { [property]: value });
        },
        setFilter: (id: string, filter: unknown) => filters.push([id, filter]),
        hasImage: (id: string) => images.has(id),
        addImage: (id: string, image: { width: number; height: number; shapes: string[] }) =>
            images.set(id, image),
        updateImage: (id: string) => updates.push(id),
    } as unknown as GeographicMap;

    return { map, sources, layers, uploads, filters, images, updates, layouts };
}

/** Keep hit testing and actual symbol drawing priorities identical across marker types. */
test("test_match_drawing_and_hit_priorities", () => {
    const mock = mockMap();
    addOrganisationLayers(mock.map, true);
    const symbols = mock.layers.find((layer) => layer.id === "organisations")!;
    for (const isSponsor of [false, true])
        for (const isLogo of [false, true])
            for (const count of [1, 2, 84]) {
                const properties = { isSponsor, isLogo, count };
                expect(evaluate(symbols.layout?.["symbol-sort-key"], properties)).toBe(
                    organisationOrder(properties),
                );
            }
});

test.each([true, false])(
    "test_resize_only_sponsor_layouts_at_700px_labelled_%s",
    async (isLabelled) => {
        const mock = mockMap();
        addOrganisationLayers(mock.map, isLabelled, 699);
        const places = groupLocations([
            office("ordinary"),
            { ...office("host"), recognition: "Host" },
            office("tenant", "shared"),
            ...(["large", "medium", "small"] as const).map((prominence) => ({
                ...office(`sponsor-${prominence}`, prominence === "large" ? "shared" : prominence),
                prominence,
                isSponsor: true,
            })),
        ]);
        await addBadges(mock.map, places, () => true);
        showOrganisations(mock.map, places, (person) => Boolean(person.recognition));
        const images = [...mock.images];
        const source = structuredClone(mock.uploads);
        const initial = structuredClone(mock.layers);

        // cross the breakpoint in both directions without changing image or source state
        for (const width of [699, 700, 1200, 390]) {
            resizeOrganisationLayers(mock.map, isLabelled, width);
            const scale = width < 700 ? 0.75 : 1;
            expect(
                validateStyleMin({
                    version: 8,
                    glyphs: "https://example.com/{fontstack}/{range}.pbf",
                    sources: mock.sources,
                    layers: mock.layers,
                }),
            ).toEqual([]);
            for (const feature of mock.uploads[0].features) {
                const properties = feature.properties!;
                for (const zoom of [0, 10, 12, 13, 14, 14.5, 18]) {
                    for (const id of ["organisations", "organisations-active"]) {
                        const layout = mock.layers.find((layer) => layer.id === id)!.layout!;
                        if (properties.isSponsor) {
                            const size = Number(String(properties.ring).split(":")[1]);
                            expect(evaluate(layout["icon-size"], properties, zoom)).toBe(scale);
                            expect(evaluate(layout["text-offset"], properties, zoom)).toEqual([
                                ((size / 2 + 4) * scale) / 12,
                                0,
                            ]);
                            expect((mock.images.get(properties.badge)!.width / 2) * scale).toBe(
                                size * scale,
                            );
                            expect((mock.images.get(properties.ring)!.width / 2) * scale).toBe(
                                (size + 8) * scale,
                            );
                        } else {
                            const original = initial.find((layer) => layer.id === id)!.layout!;
                            expect(evaluate(layout["icon-size"], properties, zoom)).toEqual(
                                evaluate(original["icon-size"], properties, zoom),
                            );
                            expect(evaluate(layout["text-offset"], properties, zoom)).toEqual(
                                evaluate(original["text-offset"], properties, zoom),
                            );
                        }
                    }
                }
            }
            expect([...mock.images]).toEqual(images);
            expect(mock.uploads).toEqual(source);
            expect(mock.updates).toEqual([]);
            expect(mock.filters).toEqual([]);
        }
        expect(mock.layouts).toHaveLength(16);
    },
);

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
        expect(mock.filters).toHaveLength(5);
        for (const [id, filter] of mock.filters) {
            const layer = mock.layers.find((layer) => layer.id === id)!;
            expect(filter).toEqual(["all", layer.filter, selection]);
        }
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
        name: "first, second",
        badge: "group-dot",
        count: 2,
        isLogo: false,
        isSponsor: false,
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
                    isSponsor: false,
                    badge: "group-dot",
                    ring: "ring-group",
                    labelOffset: [16 / 12, 0],
                },
                {
                    count: 1,
                    isLogo: true,
                    isSponsor: true,
                    badge: "badge:sponsor",
                    ring: "ring:36:true",
                    labelOffset: [22 / 12, 0],
                },
            ]) {
                expect(evaluate(layer.layout?.["icon-image"], properties, zoom)).toBe(
                    isLabelled || properties.isLogo ? properties.badge : "organisation-dot",
                );
                expect(evaluate(layer.layout?.["icon-size"], properties, zoom)).toBe(
                    isLabelled || properties.isLogo ? 1 : 0.4,
                );
                expect(evaluate(layer.paint?.["icon-opacity"], properties, zoom)).toBe(
                    isLabelled || properties.isLogo ? 1 : 0.55,
                );
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
                { count: 1, isLogo: false, isSponsor: false },
                { count: 2, isLogo: false, isSponsor: false },
                { count: 1, isLogo: true, isSponsor: false },
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
        const sponsorSize = { large: 48, medium: 44, small: 40 }[prominence];
        expect(mock.images.get(`badge:sponsor-${prominence}`)).toMatchObject({
            width: sponsorSize * 2,
            height: sponsorSize * 2,
            shapes: ["square", "square", "square"],
            fills: ["#ffffff", "#174ed8", "#ffffff"],
            rectangles: [
                [4, 4, sponsorSize * 2 - 8, sponsorSize * 2 - 8, 16],
                [8, 8, sponsorSize * 2 - 16, sponsorSize * 2 - 16, 12],
                [14, 14, sponsorSize * 2 - 28, sponsorSize * 2 - 28, 8],
            ],
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
        ).toBe(`ring:${sponsorSize}:true`);
    }
});

test("test_show_prominent_names_before_ordinary_labels_and_keep_hero_groups_quiet", () => {
    for (const isLabelled of [true, false]) {
        const mock = mockMap();
        addOrganisationLayers(mock.map, isLabelled);
        const layer = mock.layers.find((entry) => entry.id === "organisations")!;
        for (const isLogo of [false, true]) {
            const properties = {
                name: "Example",
                isLogo,
                isSponsor: false,
                count: 1,
                badge: "badge:example",
            };
            expect(evaluate(layer.layout?.["text-field"], properties, 12)).toBe(
                isLabelled && isLogo ? "Example" : "",
            );
            expect(evaluate(layer.paint?.["text-opacity"], properties, 12)).toBe(isLogo ? 1 : 0);
            expect(evaluate(layer.layout?.["text-field"], properties, 15)).toBe(
                isLabelled ? "Example" : "",
            );
            if (!isLabelled) {
                for (const count of [1, 2, 30]) {
                    const feature = { ...properties, isLogo: false, count };
                    expect(evaluate(layer.layout?.["icon-image"], feature, 12)).toBe(
                        "organisation-dot",
                    );
                    expect(evaluate(layer.layout?.["icon-size"], feature, 12)).toBe(0.4);
                    expect(evaluate(layer.paint?.["icon-opacity"], feature, 12)).toBe(0.55);
                }
            }
        }
    }
});

test("test_distinguish_sponsor_tiers_and_keep_names_visible_at_overview_zoom", async () => {
    const mock = mockMap();
    addOrganisationLayers(mock.map, true);
    const tiers = [
        ["Gold sponsor", "#c99a20"],
        ["Silver sponsor", "#75879e"],
        ["Bronze sponsor", "#bf6c32"],
    ] as const;
    const places = groupLocations(
        tiers.map(([recognition], index) => ({
            ...office(`tier-${index}`),
            name: "Same initial",
            isSponsor: true,
            recognition,
            prominence: "large" as const,
        })),
    );
    await addBadges(mock.map, places, () => true);

    // equal initials and host prominence must not reuse a different tier's coloured image
    for (const [index, [, colour]] of tiers.entries()) {
        expect(mock.images.get(`badge:tier-${index}`)).toMatchObject({
            fills: ["#ffffff", colour, "#ffffff"],
        });
    }
    const layer = mock.layers.find((entry) => entry.id === "organisations")!;
    const sponsor = { isSponsor: true, isLogo: true, name: "Sponsor" };
    expect(evaluate(layer.paint?.["text-opacity"], sponsor, 10)).toBe(1);
    expect(evaluate(layer.layout?.["text-size"], sponsor, 10)).toBe(13);
});

test("test_keep_shared_sponsors_visible_and_reveal_ordinary_stacks_only_close_up", async () => {
    const mock = mockMap();
    const requested: string[] = [];
    Object.defineProperty(globalThis, "Image", {
        configurable: true,
        value: class {
            width = 32;
            height = 32;
            src = "";
            async decode() {
                requested.push(this.src);
            }
        },
    });
    const places = groupLocations([
        ...["Alpha", "Beta", "Gamma", "Delta"].map((name) => ({
            ...office(name, "ordinary"),
            logoUrl: `https://example.com/${name}.png`,
        })),
        { ...office("Tenant", "sponsored"), logoUrl: "https://example.com/tenant.png" },
        {
            ...office("Sponsor", "sponsored"),
            logoUrl: "https://example.com/sponsor.png",
            isSponsor: true,
            recognition: "Gold sponsor",
        },
    ]);
    addOrganisationLayers(mock.map, true);
    await addBadges(mock.map, places, () => true);
    showOrganisations(mock.map, places, (person) => Boolean(person.recognition));
    const layer = mock.layers.find((entry) => entry.id === "organisations")!;
    const ordinary = mock.uploads[0].features[0].properties!;
    const sponsored = mock.uploads[0].features[1].properties!;
    const stacks = mock.layers.find((entry) => entry.id === "organisation-stacks")!;
    expect(evaluate(stacks.paint?.["icon-opacity"], ordinary, 13)).toBe(0);
    expect(evaluate(stacks.layout?.["icon-image"], ordinary, 14)).toBe(`stack:${places[0].id}`);
    expect(evaluate(layer.filter, ordinary)).toBe(false);
    expect(evaluate(layer.filter, sponsored)).toBe(true);
    expect(evaluate(layer.layout?.["icon-image"], sponsored, 10)).toBe("badge:Sponsor");
    expect(evaluate(layer.layout?.["icon-image"], sponsored, 16)).toBe("badge:Sponsor");
    expect(sponsored.name).toBe("Sponsor");
    expect(sponsored.ring).toBe("ring:40:true");
    const active = mock.layers.find((entry) => entry.id === "organisations-active")!;
    expect(evaluate(active.layout?.["icon-image"], sponsored, 16)).toBe("ring:40:true");
    expect(requested.sort()).toEqual(
        ["Alpha", "Beta", "Delta", "sponsor"]
            .map((name) => `https://example.com/${name}.png`)
            .sort(),
    );
    expect(mock.images.has(`stack:${places[1].id}`)).toBe(false);
    expect(mock.images.get("badge:Sponsor")).toMatchObject({
        shapes: ["square", "square", "square"],
    });
    expect(mock.images.get("group-dot")).toMatchObject({ shapes: ["round"] });

    // repeated filter or view work must not redownload or recreate the shared images
    await addBadges(mock.map, places, () => true);
    expect(requested).toHaveLength(4);
});

test("test_crossfade_dots_and_badges_continuously_through_fractional_zoom", () => {
    const mock = mockMap();
    addOrganisationLayers(mock.map, true);

    // keep both images available while their opacity changes in opposite directions
    for (const count of [1, 3]) {
        const badges = mock.layers.find(
            (layer) => layer.id === (count === 1 ? "organisation-badges" : "organisation-stacks"),
        )!;
        const dots = mock.layers.find(
            (layer) => layer.id === (count === 1 ? "organisation-dots" : "organisation-group-dots"),
        )!;
        expect(dots.maxzoom).toBeUndefined();
        for (const layer of [badges, dots]) {
            const compiled = createPropertyExpression(
                layer.paint?.["icon-opacity"],
                `layers.${layer.id}.paint.icon-opacity`,
                latest.paint_symbol["icon-opacity"] as StylePropertySpecification,
            );
            expect(compiled.result).toBe("success");
            if (compiled.result === "success") expect(compiled.value.kind).toBe("camera");
        }
        const properties = { count, isLogo: false, isSponsor: false, badge: "example" };
        const start = count === 1 ? 13 : 14;
        for (const offset of [-0.01, 0, 0.01, 0.25, 0.5, 0.75, 0.99, 1, 1.01]) {
            const zoom = start + offset;
            const opacity = Math.max(0, Math.min(1, offset));
            expect(evaluate(badges.layout?.["icon-image"], properties, zoom)).toBe("example");
            expect(evaluate(badges.paint?.["icon-opacity"], properties, zoom)).toBeCloseTo(opacity);
            expect(evaluate(dots.paint?.["icon-opacity"], properties, zoom)).toBeCloseTo(
                1 - opacity,
            );
        }
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
