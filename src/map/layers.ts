import type { ExpressionSpecification, GeoJSONSource, Map as GeographicMap } from "maplibre-gl";
import { honeycomb } from "./placement";
import type { MapLocation } from "./queries";

/** Badge diameter in CSS pixels at full scale. */
const badgeSize = 32;

/** Pixel distance between badges of organisations sharing a building at full scale. */
const badgeSpacing = 36;

/** Badge scale at each zoom, growing from the city overview to street level. */
const badgeScales = [
    [10, 0.5],
    [12, 0.7],
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
    map.addImage("ring-active", drawRing(badgeSize + 8, "#ffffff"), { pixelRatio });
    map.addImage("logo-space", new ImageData(logoSpace * pixelRatio, logoSpace * pixelRatio), {
        pixelRatio,
    });

    // draw every organisation, naming it where the label fits
    map.addLayer({
        id: "organisations",
        type: "symbol",
        source: "organisations",
        layout: {
            "icon-image": ["case", ["get", "isLogo"], "logo-space", ["get", "badge"]],
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
            "text-color": "#ffffff",
            "text-halo-color": "#174ed8",
            "text-halo-width": 1.5,
        },
    });

    // mark hovered and selected organisations above the rest
    map.addLayer({
        id: "organisations-active",
        type: "symbol",
        source: "organisations",
        filter: ["literal", false],
        layout: {
            "icon-image": "ring-active",
            "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                ...badgeScales.flat(),
            ] as unknown as ExpressionSpecification,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
        },
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

    // one slow image must not hold back other markers or write into a disposed map
    await Promise.all(
        missing.map(async (person) => {
            const source = person.mapLogoUrl ?? person.logoUrl;
            if (!source) return;
            const image = await loadImage(source);
            if (image && isActive()) map.updateImage(badgeId(person), drawBadge(person, image));
        }),
    );
}

/** Show these places, with logos at their centre and every other organisation fanned out around them. */
export function showOrganisations(
    map: GeographicMap,
    places: MapLocation[],
    isHighlighted: (organisation: Organisation) => boolean,
) {
    // lay out logos at the centre and every other organisation around them
    const entries = places.flatMap((place) => {
        const logos = place.organisations.filter(isHighlighted);
        const others = place.organisations.filter((person) => !isHighlighted(person));
        return [
            ...logos.map((person) => ({ place, person, isLogo: true, cell: 0 })),
            ...others.map((person, index) => ({
                place,
                person,
                isLogo: false,
                cell: index + Number(logos.length > 0),
            })),
        ];
    });

    // replace the source data
    const source = map.getSource<GeoJSONSource>("organisations");
    source?.setData({
        type: "FeatureCollection",
        features: entries.map(({ place, person, isLogo, cell }) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [place.longitude, place.latitude] },
            properties: {
                id: person.id,
                place: place.id,
                name: person.name,
                badge: badgeId(person),
                isLogo,
                cell,
            },
        })),
    });

    // cover every honeycomb cell in use; icon offsets scale with the icon, labels follow each scale
    const cells = Math.max(1, ...entries.map((entry) => entry.cell + 1));
    const iconOffset = cellOffsets(cells, badgeSpacing, 0);
    const labelOffset = [
        "interpolate",
        ["linear"],
        ["zoom"],
        ...badgeScales.flatMap(([zoom, scale]) => [
            zoom,
            cellOffsets(
                cells,
                (badgeSpacing * scale) / labelSize,
                ((badgeSize * scale) / 2 + 4) / labelSize,
            ),
        ]),
    ] as unknown as ExpressionSpecification;
    map.setLayoutProperty("organisations", "icon-offset", iconOffset);
    map.setLayoutProperty("organisations-active", "icon-offset", iconOffset);
    map.setLayoutProperty("organisations", "text-offset", labelOffset);
}

/** Mark these organisations as hovered or selected. */
export function highlightOrganisations(map: GeographicMap, ids: string[]) {
    map.setFilter("organisations-active", [
        "all",
        ["!", ["get", "isLogo"]],
        ["in", ["get", "id"], ["literal", ids]],
    ]);
}

/** Return the image id of an organisation's badge. */
function badgeId(organisation: Organisation) {
    return `badge:${organisation.id}`;
}

/** Map each honeycomb cell to its offset, shifted right for labels. */
function cellOffsets(count: number, spacing: number, shift: number): ExpressionSpecification {
    const cases = Array.from({ length: count }, (_, cell) => {
        const [x, y] = honeycomb(cell, spacing);
        return [cell, ["literal", [x + shift, y]]];
    });

    // NOTE: the style types cannot describe a match with a computed number of cases
    return [
        "match",
        ["get", "cell"],
        ...cases.flat(),
        ["literal", [shift, 0]],
    ] as unknown as ExpressionSpecification;
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

/** Draw an organisation's icon, or its initial, inside a white circle. */
function drawBadge(organisation: Organisation, image?: HTMLImageElement) {
    const { canvas, context, radius } = createCanvas(badgeSize);

    // white disc with a fine outline
    context.fillStyle = "#bbc8df";
    context.beginPath();
    context.arc(radius, radius, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffffff";
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
