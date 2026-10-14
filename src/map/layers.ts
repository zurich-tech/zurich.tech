import type {
    ExpressionSpecification,
    GeoJSONSource,
    Map as GeographicMap,
    SymbolLayerSpecification,
} from "maplibre-gl";
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

/** Space kept clear of labels under each host or sponsor logo, in CSS pixels. */
const logoSpace = 40;

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
    map.addImage("logo-space", new ImageData(logoSpace * pixelRatio, logoSpace * pixelRatio), {
        pixelRatio,
    });
    map.addImage("organisation-dot", drawDot(isLabelled ? "#174ed8" : "#ffffff"), {
        pixelRatio,
    });

    // draw every organisation, naming it where the label fits
    const organisations: SymbolLayerSpecification = {
        id: "organisations",
        type: "symbol",
        source: "organisations",
        layout: {
            "icon-image": isLabelled
                ? ["case", ["get", "isLogo"], "logo-space", ["get", "badge"]]
                : ["case", ["get", "isLogo"], "logo-space", "organisation-dot"],
            "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                ...badgeScales.flatMap(([zoom, scale]) => [
                    zoom,
                    ["case", ["get", "isLogo"], 1, scale],
                ]),
            ] as unknown as ExpressionSpecification,
            "icon-allow-overlap": true,
            "symbol-sort-key": ["case", ["get", "isLogo"], 0, 1],
            "text-field": isLabelled ? ["case", ["get", "isLogo"], "", ["get", "name"]] : "",
            "text-font": ["Noto Sans Regular"],
            "text-size": labelSize,
            "text-anchor": "left",
            "text-optional": true,
            "text-max-width": 12,
        },
        paint: {
            "icon-opacity": isLabelled ? ["interpolate", ["linear"], ["zoom"], 12, 0, 13, 1] : 1,
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
            maxzoom: 13,
            layout: {
                ...organisations.layout,
                "icon-image": ["case", ["get", "isLogo"], "logo-space", "organisation-dot"],
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
            "icon-image": ["case", [">", ["get", "count"], 1], "logo-space", "ring-active"],
            "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                ...badgeScales.flatMap(([zoom, scale]) => [zoom, scale]),
            ] as unknown as ExpressionSpecification,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "text-field": isLabelled ? ["get", "name"] : "",
            "text-font": ["Noto Sans Regular"],
            "text-size": labelSize,
            "text-anchor": "left",
            "text-allow-overlap": false,
            "text-optional": true,
        },
        paint: { "text-color": "#174ed8", "text-halo-color": "#ffffff", "text-halo-width": 2 },
    });
}

/** Show initials immediately, then upgrade each badge independently as its logo arrives. */
export async function addBadges(
    map: GeographicMap,
    places: MapLocation[],
    isActive: () => boolean,
) {
    const missing = [
        ...new Map(
            places
                .flatMap((place) => place.organisations)
                .map((person) => [badgeId(person), person]),
        ).values(),
    ].filter((person) => !map.hasImage(badgeId(person)));
    // register every initial before starting any image downloads
    for (const person of missing) map.addImage(badgeId(person), drawBadge(person), { pixelRatio });

    // bound downloads and decoding rather than flooding a phone with every logo at once
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(6, missing.length) }, async () => {
            while (next < missing.length && isActive()) {
                const person = missing[next++];
                const source = person.mapLogoUrl ?? person.logoUrl;
                if (!source) continue;
                const image = await loadImage(source);
                if (image && isActive()) map.updateImage(badgeId(person), drawBadge(person, image));
            }
        }),
    );
}

/** Show one marker per address without displacing any member of a shared address. */
export function showOrganisations(
    map: GeographicMap,
    places: MapLocation[],
    isHighlighted: (organisation: Organisation, place: MapLocation) => boolean,
) {
    // replace the source data
    const source = map.getSource<GeoJSONSource>("organisations");
    source?.setData({
        type: "FeatureCollection",
        features: places.map((place) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [place.longitude, place.latitude] },
            properties: {
                id: place.organisations.length > 1 ? place.id : place.organisations[0].id,
                place: place.id,
                name:
                    place.organisations.length > 1 ? placeName(place) : place.organisations[0].name,
                badge: badgeId(place.organisations[0]),
                count: place.organisations.length,
                isLogo:
                    place.organisations.length > 1 || isHighlighted(place.organisations[0], place),
            },
        })),
    });

    // keep labels beside their anchored badges at every zoom
    const labelOffset = [
        "interpolate",
        ["linear"],
        ["zoom"],
        ...badgeScales.flatMap(([zoom, scale]) => [
            zoom,
            ["literal", [((badgeSize * scale) / 2 + 4) / labelSize, 0]],
        ]),
    ] as unknown as ExpressionSpecification;
    map.setLayoutProperty("organisations", "text-offset", labelOffset);
    map.setLayoutProperty("organisations-active", "text-offset", labelOffset);
}

/** Mark these organisations as hovered or selected. */
export function highlightOrganisations(map: GeographicMap, places: MapLocation[], ids: string[]) {
    // resolve organisation selection to its address, including members of shared markers
    const active = new Set(ids);
    const addresses = places
        .filter((place) => place.organisations.some((person) => active.has(person.id)))
        .map((place) => place.id);

    map.setFilter("organisations-active", [
        "all",
        ["any", ["!", ["get", "isLogo"]], [">", ["get", "count"], 1]],
        ["in", ["get", "place"], ["literal", addresses]],
    ]);
}

/** Return the image id of an organisation's badge. */
function badgeId(organisation: Organisation) {
    return `badge:${organisation.id}`;
}

/** Draw an open ring marking an active badge. */
function drawRing(diameter: number, colour: string) {
    const { canvas, context, radius } = createCanvas(diameter);
    context.strokeStyle = colour;
    context.lineWidth = 2 * pixelRatio;
    context.beginPath();
    context.arc(radius, radius, radius - pixelRatio, 0, Math.PI * 2);
    context.stroke();

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

/** Draw an organisation's icon, or its initial, inside a white circle. */
function drawBadge(organisation: Organisation, image?: HTMLImageElement) {
    const { canvas, context, radius } = createCanvas(badgeSize);

    // extend solid logo backgrounds into the disc, retaining a fine outline
    context.fillStyle = "#bbc8df";
    context.beginPath();
    context.arc(radius, radius, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = image ? logoBackground(image) : "#ffffff";
    context.beginPath();
    context.arc(radius, radius, radius - pixelRatio, 0, Math.PI * 2);
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
async function loadImage(source: string) {
    const image = new Image();
    // request permission to read external logos back from the badge canvas
    image.crossOrigin = "anonymous";
    image.src = source;
    try {
        await image.decode();
        return image;
    } catch (error) {
        console.error(`Map icon failed to load: ${source}`, error);
        return undefined;
    }
}

/** Create a square canvas for a circle of this diameter at the drawing resolution. */
function createCanvas(diameter: number) {
    const canvas = document.createElement("canvas");
    canvas.width = diameter * pixelRatio;
    canvas.height = diameter * pixelRatio;
    const context = canvas.getContext("2d")!;

    return { canvas, context, radius: canvas.width / 2 };
}
