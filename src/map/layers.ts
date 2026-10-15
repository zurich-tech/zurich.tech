import type {
    ExpressionSpecification,
    GeoJSONSource,
    Map as GeographicMap,
    SymbolLayerSpecification,
} from "maplibre-gl";
import { isHostedLogo } from "../organisations/logos";
import { logoBackground } from "./colour";
import { placeName } from "./places";
import type { MapLocation } from "./queries";

/** Badge diameter in CSS pixels at full scale. */
const badgeSize = 32;

/** Zoom and badge scale from city overview to street level. */
const badgeScales = [
    [10, 0.5],
    [12, 0.7],
    [13, 0.82],
    [14.5, 1],
] as const;

/** Fixed diameter of a shared-address marker in CSS pixels. */
const groupSize = 24;

/** Full-size sponsor and host diameters in CSS pixels. */
const prominentSizes = { large: 36, medium: 30, small: 26 } as const;

/** Restrict overview dots to ordinary single-organisation markers. */
const dotsFilter: ExpressionSpecification = [
    "all",
    ["==", ["get", "count"], 1],
    ["!", ["get", "isLogo"]],
];

/** Label size in CSS pixels. */
const labelSize = 12;

/** Resolution of every drawn image relative to CSS pixels. */
const pixelRatio = 2;

/** One organisation on the map. */
type Organisation = MapLocation["organisations"][number];

/** Add the organisation source, its shared images and the badge and label layers. */
export function addOrganisationLayers(map: GeographicMap, isLabelled: boolean) {
    map.addSource("organisations", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
    });

    // draw the shared images once
    map.addImage("ring-active", drawRing(badgeSize + 8, isLabelled ? "#174ed8" : "#ffffff"), {
        pixelRatio,
    });
    map.addImage("group-dot", drawGroup(), { pixelRatio });
    map.addImage("ring-group", drawRing(groupSize + 8, "#174ed8"), { pixelRatio });
    map.addImage("organisation-dot", drawDot(isLabelled ? "#174ed8" : "#ffffff"), {
        pixelRatio,
    });

    // keep prominent selection outlines fixed to the full badge size
    for (const size of [...Object.values(prominentSizes), badgeSize]) {
        for (const isSquare of [false, true]) {
            map.addImage(
                `ring:${size}:${isSquare}`,
                drawRing(size + 8, isLabelled ? "#174ed8" : "#ffffff", isSquare),
                { pixelRatio },
            );
        }
    }

    // offset labels once beside the fixed group, prominent badge or zoom-scaled ordinary badge
    const labelOffset = [
        "interpolate",
        ["linear"],
        ["zoom"],
        ...badgeScales.flatMap(([zoom, scale]) => [
            zoom,
            [
                "case",
                [">", ["get", "count"], 1],
                ["literal", [(groupSize / 2 + 4) / labelSize, 0]],
                ["get", "isLogo"],
                ["get", "labelOffset"],
                ["literal", [((badgeSize * scale) / 2 + 4) / labelSize, 0]],
            ],
        ]),
    ] as unknown as ExpressionSpecification;

    // draw every organisation, naming it where the label fits
    const organisations: SymbolLayerSpecification = {
        id: "organisations",
        type: "symbol",
        source: "organisations",
        layout: {
            "icon-image": [
                "case",
                [">", ["get", "count"], 1],
                "group-dot",
                ["get", "isLogo"],
                ["get", "badge"],
                isLabelled ? ["get", "badge"] : "organisation-dot",
            ],
            "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                ...badgeScales.flatMap(([zoom, scale]) => [
                    zoom,
                    ["case", ["any", ["get", "isLogo"], [">", ["get", "count"], 1]], 1, scale],
                ]),
            ] as unknown as ExpressionSpecification,
            "icon-allow-overlap": true,
            "symbol-sort-key": ["case", ["get", "isLogo"], 2, [">", ["get", "count"], 1], 1, 0],
            "symbol-z-order": "source",
            "text-field": isLabelled ? ["get", "name"] : "",
            "text-font": ["Noto Sans Regular"],
            "text-size": labelSize,
            "text-anchor": "left",
            "text-offset": labelOffset,
            "text-optional": true,
            "text-max-width": 12,
        },
        paint: {
            "icon-opacity": isLabelled
                ? [
                      "interpolate",
                      ["linear"],
                      ["zoom"],
                      12,
                      ["case", ["any", ["get", "isLogo"], [">", ["get", "count"], 1]], 1, 0],
                      13,
                      1,
                  ]
                : 1,
            "text-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
            "text-color": isLabelled ? "#26364a" : "#ffffff",
            "text-halo-color": isLabelled ? "#edf0f2" : "#174ed8",
            "text-halo-width": 1.5,
        },
    };

    // crossfade dots into logos before introducing organisation names
    if (isLabelled) {
        map.addLayer({
            ...organisations,
            id: "organisation-dots",
            filter: dotsFilter,
            maxzoom: 13,
            layout: {
                ...organisations.layout,
                "icon-image": "organisation-dot",
                "text-field": "",
            },
            paint: { "icon-opacity": ["interpolate", ["linear"], ["zoom"], 12, 1, 13, 0] },
        });
    }
    map.addLayer(organisations);

    // mark hovered and selected organisations above the rest
    map.addLayer({
        id: "organisations-active",
        type: "symbol",
        source: "organisations",
        filter: ["literal", false],
        layout: {
            "icon-image": ["get", "ring"],
            "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                ...badgeScales.flatMap(([zoom, scale]) => [
                    zoom,
                    ["case", ["any", ["get", "isLogo"], [">", ["get", "count"], 1]], 1, scale],
                ]),
            ] as unknown as ExpressionSpecification,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "text-field": isLabelled ? ["get", "name"] : "",
            "text-font": ["Noto Sans Regular"],
            "text-size": labelSize,
            "text-anchor": "left",
            "text-offset": labelOffset,
            "text-allow-overlap": false,
            "text-optional": true,
        },
        paint: { "text-color": "#174ed8", "text-halo-color": "#ffffff", "text-halo-width": 2 },
    });
}

/** Load full-data single-place badges for the map lifetime, never for search results. */
export async function addBadges(
    map: GeographicMap,
    places: MapLocation[],
    isActive: () => boolean,
) {
    const missing = [
        ...new Map(
            places
                .filter((place) => place.organisations.length === 1)
                .flatMap((place) => place.organisations)
                .map((person) => [badgeId(person), person]),
        ).values(),
    ].filter((person) => !map.hasImage(badgeId(person)));
    // draw identical placeholders once; MapLibre copies pixels into each independent image id
    const initials = new Map<string, ImageData>();
    for (const person of missing) {
        const initial = `${person.name.slice(0, 1).toUpperCase()}:${person.isSponsor ?? false}:${organisationSize(person)}`;
        let image = initials.get(initial);
        if (!image) {
            image = drawBadge(person);
            initials.set(initial, image);
        }
        map.addImage(badgeId(person), image, { pixelRatio });
    }

    // bound downloads and decoding rather than flooding a phone with every logo at once
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(6, missing.length) }, async () => {
            while (next < missing.length && isActive()) {
                const person = missing[next++];
                const source = person.mapLogoUrl ?? person.logoUrl;
                if (!source) continue;
                const image = await loadImage(source, isActive);
                if (image && isActive()) map.updateImage(badgeId(person), drawBadge(person, image));
            }
        }),
    );
}

/** Upload full places when data or highlighting changes, not when the search changes. */
export function showOrganisations(
    map: GeographicMap,
    places: MapLocation[],
    isHighlighted: (organisation: Organisation, place: MapLocation) => boolean,
) {
    // replace the source data
    const source = map.getSource<GeoJSONSource>("organisations");
    source?.setData({
        type: "FeatureCollection",
        features: places.map((place) => {
            const organisation = place.organisations[0];
            const isGroup = place.organisations.length > 1;
            const isLogo = !isGroup && isHighlighted(organisation, place);
            const size = isGroup ? groupSize : organisationSize(organisation);

            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [place.longitude, place.latitude] },
                properties: {
                    id: place.organisations.length > 1 ? place.id : place.organisations[0].id,
                    place: place.id,
                    name:
                        place.organisations.length > 1
                            ? placeName(place)
                            : place.organisations[0].name,
                    badge: isGroup ? "group-dot" : badgeId(organisation),
                    count: place.organisations.length,
                    isLogo,
                    labelOffset: [(size / 2 + 4) / labelSize, 0],
                    ring: isGroup
                        ? "ring-group"
                        : isLogo
                          ? `ring:${size}:${organisation.isSponsor ?? false}`
                          : "ring-active",
                },
            };
        }),
    });
}

/** Filter visible addresses without replacing source data or changing active selection. */
export function filterOrganisations(map: GeographicMap, places: MapLocation[]) {
    const filter: ExpressionSpecification = [
        "in",
        ["get", "place"],
        ["literal", places.map((place) => place.id)],
    ];
    map.setFilter("organisations", filter);
    if (map.getLayer("organisation-dots"))
        map.setFilter("organisation-dots", ["all", dotsFilter, filter]);
}

/** Mark these organisations as hovered or selected. */
export function highlightOrganisations(map: GeographicMap, places: MapLocation[], ids: string[]) {
    // resolve organisation selection to its address, including members of shared markers
    const active = new Set(ids);
    const addresses = places
        .filter((place) => place.organisations.some((person) => active.has(person.id)))
        .map((place) => place.id);

    map.setFilter("organisations-active", ["in", ["get", "place"], ["literal", addresses]]);
}

/** Return the full badge diameter for a prominent logo or ordinary organisation. */
function organisationSize(organisation: Organisation) {
    return organisation.isSponsor || organisation.recognition
        ? prominentSizes[organisation.prominence]
        : badgeSize;
}

/** Return the image id of an organisation's badge. */
function badgeId(organisation: Organisation) {
    return `badge:${organisation.id}`;
}

/** Draw an open ring marking an active badge. */
function drawRing(diameter: number, colour: string, isSquare = false) {
    const { canvas, context, radius } = createCanvas(diameter);
    context.strokeStyle = colour;
    context.lineWidth = 2 * pixelRatio;
    context.beginPath();
    if (isSquare)
        context.roundRect(
            pixelRatio,
            pixelRatio,
            diameter * pixelRatio - 2 * pixelRatio,
            diameter * pixelRatio - 2 * pixelRatio,
            8 * pixelRatio,
        );
    else context.arc(radius, radius, radius - pixelRatio, 0, Math.PI * 2);
    context.stroke();

    return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Draw the white-edged blue stacked marker within fixed shared-address bounds. */
function drawGroup() {
    const { canvas, context } = createCanvas(groupSize);

    // reproduce the two offset backing dots and white border from the shared-marker CSS
    for (const [x, y, radius, colour] of [
        [15, 9, 8.5, "#c3d3f5"],
        [13, 11, 8.5, "#8caaf0"],
        [11, 13, 8.5, "#ffffff"],
        [11, 13, 6.5, "#174ed8"],
    ] as const) {
        context.fillStyle = colour;
        context.beginPath();
        context.arc(x * pixelRatio, y * pixelRatio, radius * pixelRatio, 0, Math.PI * 2);
        context.fill();
    }

    return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Draw a compact overview dot within the same bounds as an organisation badge. */
function drawDot(colour: string) {
    const { canvas, context, radius } = createCanvas(badgeSize);
    context.fillStyle = colour;
    context.beginPath();
    context.arc(radius, radius, 5 * pixelRatio, 0, Math.PI * 2);
    context.fill();

    return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Draw a complete logo or initial inside a round host badge or rounded sponsor square. */
function drawBadge(organisation: Organisation, image?: HTMLImageElement) {
    const { canvas, context, radius } = createCanvas(organisationSize(organisation));

    // extend solid logo backgrounds into the disc, retaining a fine outline
    context.fillStyle = "#bbc8df";
    context.beginPath();
    if (organisation.isSponsor)
        context.roundRect(0, 0, canvas.width, canvas.height, 6 * pixelRatio);
    else context.arc(radius, radius, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = image ? logoBackground(image) : "#ffffff";
    context.beginPath();
    if (organisation.isSponsor)
        context.roundRect(
            pixelRatio,
            pixelRatio,
            canvas.width - 2 * pixelRatio,
            canvas.height - 2 * pixelRatio,
            5 * pixelRatio,
        );
    else context.arc(radius, radius, radius - pixelRatio, 0, Math.PI * 2);
    context.fill();

    // icon clipped to the disc, or the initial when there is none
    if (image) {
        const size = radius * 1.5;
        const scale = Math.min(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.save();
        context.clip();
        context.drawImage(image, radius - width / 2, radius - height / 2, width, height);
        context.restore();
    } else {
        context.fillStyle = "#172b49";
        context.font = `600 ${radius}px system-ui, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(organisation.name.slice(0, 1).toUpperCase(), radius, radius + pixelRatio);
    }

    return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Load an image, reporting a failure and returning nothing so the badge shows the initial. */
async function loadImage(source: string, isActive: () => boolean) {
    try {
        // use the normal anonymous image request unless its cached response fails
        try {
            return await decodeImage(source);
        } catch (error) {
            if (!isActive()) return;
            if (!isHostedLogo(source)) throw error;
        }

        // refresh only our public logo, then retry decoding once in the same download slot
        const response = await fetch(source, {
            mode: "cors",
            credentials: "omit",
            cache: "reload",
        });
        if (!response.ok) throw new Error(`Map icon reload failed: HTTP ${response.status}`);
        await response.arrayBuffer();
        if (!isActive()) return;

        return await decodeImage(source);
    } catch (error) {
        if (isActive()) console.error(`Map icon failed to load: ${source}`, error);

        return undefined;
    }
}

/** Decode a fresh anonymous image so its pixels can be read by the badge canvas. */
async function decodeImage(source: string) {
    const image = new Image();
    // request permission to read external logos back from the badge canvas
    image.crossOrigin = "anonymous";
    image.src = source;
    await image.decode();

    return image;
}

/** Create a square canvas for a circle of this diameter at the drawing resolution. */
function createCanvas(diameter: number) {
    const canvas = document.createElement("canvas");
    canvas.width = diameter * pixelRatio;
    canvas.height = diameter * pixelRatio;
    const context = canvas.getContext("2d")!;

    return { canvas, context, radius: canvas.width / 2 };
}
