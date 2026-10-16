import type {
    ExpressionSpecification,
    GeoJSONSource,
    Map as GeographicMap,
    SymbolLayerSpecification,
} from "maplibre-gl";
import { isHostedLogo } from "../organisations/logos";
import { logoBackground } from "./colour";
import { placeName, stackOrganisations } from "./places";
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

/** Shared-address bounds leave room for overlapping logos and sponsor halos. */
const stackWidth = 80;

/** Full-size host diameters in CSS pixels. */
const prominentSizes = { large: 36, medium: 30, small: 26 } as const;

/** Sponsor tiles stay larger than ordinary badges at every zoom. */
const sponsorSizes = { large: 48, medium: 44, small: 40 } as const;

/** Viewport width below which sponsor tiles use compact sizing. */
const sponsorBreakpoint = 700;

/** Compact sponsor tiles retain three quarters of their desktop dimensions. */
const compactSponsorScale = 0.75;

/** Match the public sponsorship labels to the tier badge colours. */
const sponsorColours: Record<string, string> = {
    "Gold sponsor": "#c99a20",
    "Silver sponsor": "#75879e",
    "Bronze sponsor": "#bf6c32",
};

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
export function addOrganisationLayers(
    map: GeographicMap,
    isLabelled: boolean,
    width = sponsorBreakpoint,
) {
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
    const stackRing = createCanvas(52, stackWidth + 8);
    stackRing.context.strokeStyle = "#174ed8";
    stackRing.context.lineWidth = 2 * pixelRatio;
    stackRing.context.beginPath();
    stackRing.context.roundRect(2, 2, stackRing.canvas.width - 4, stackRing.canvas.height - 4, 12);
    stackRing.context.stroke();
    map.addImage(
        "ring-stack",
        stackRing.context.getImageData(0, 0, stackRing.canvas.width, stackRing.canvas.height),
        { pixelRatio },
    );
    map.addImage("organisation-dot", drawDot(isLabelled ? "#174ed8" : "#ffffff"), {
        pixelRatio,
    });

    // keep prominent selection outlines fixed to the full badge size
    for (const size of [
        ...Object.values(prominentSizes),
        ...Object.values(sponsorSizes),
        badgeSize,
    ]) {
        for (const isSquare of [false, true]) {
            map.addImage(
                `ring:${size}:${isSquare}`,
                drawRing(size + 8, isLabelled ? "#174ed8" : "#ffffff", isSquare),
                { pixelRatio },
            );
        }
    }

    const sizing = organisationSizing(isLabelled, width);

    // draw every organisation, naming it where the label fits
    const organisations: SymbolLayerSpecification = {
        id: "organisations",
        type: "symbol",
        source: "organisations",
        layout: {
            "icon-image": isLabelled
                ? [
                      "step",
                      ["zoom"],
                      [
                          "case",
                          ["all", [">", ["get", "count"], 1], ["!", ["get", "isLogo"]]],
                          "group-dot",
                          ["get", "badge"],
                      ],
                      14,
                      ["get", "badge"],
                  ]
                : ["case", ["get", "isLogo"], ["get", "badge"], "organisation-dot"],
            ...sizing,
            "icon-allow-overlap": true,
            "symbol-sort-key": [
                "case",
                ["get", "isSponsor"],
                3,
                ["get", "isLogo"],
                2,
                [">", ["get", "count"], 1],
                1,
                0,
            ],
            "symbol-z-order": "source",
            "text-field": isLabelled
                ? [
                      "step",
                      ["zoom"],
                      ["case", ["get", "isLogo"], ["get", "name"], ""],
                      14,
                      ["get", "name"],
                  ]
                : "",
            "text-font": ["Noto Sans Regular"],
            "text-size": ["case", ["get", "isSponsor"], 13, labelSize],
            "text-anchor": "left",
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
                : ["case", ["get", "isLogo"], 1, 0.55],
            "text-opacity": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11,
                ["case", ["get", "isSponsor"], 1, 0],
                12,
                ["case", ["get", "isLogo"], 1, 0],
                14,
                ["case", ["get", "isLogo"], 1, 0],
                15,
                1,
            ],
            "text-color": isLabelled
                ? ["case", ["get", "isSponsor"], "#174ed8", "#26364a"]
                : "#ffffff",
            "text-halo-color": isLabelled ? "#ffffff" : "#174ed8",
            "text-halo-width": ["case", ["get", "isSponsor"], 3, 1.5],
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
            "icon-image": [
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
            ],
            ...organisationSizing(true, width),
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

/** Resize sponsor tiles and outlines without recreating images, layers or source features. */
export function resizeOrganisationLayers(map: GeographicMap, isLabelled: boolean, width: number) {
    for (const [id, labelled] of [
        ["organisations", isLabelled],
        ["organisations-active", true],
    ] as const) {
        const sizing = organisationSizing(labelled, width);
        for (const property of ["icon-size", "text-offset"] as const)
            map.setLayoutProperty(id, property, sizing[property]);
    }
}

/** Build matching badge, outline and label dimensions for the current viewport. */
function organisationSizing(isLabelled: boolean, width: number) {
    const sponsorScale = width < sponsorBreakpoint ? compactSponsorScale : 1;
    const sponsorOffset = [
        "match",
        ["get", "ring"],
        ...Object.values(sponsorSizes).flatMap((size) => [
            `ring:${size}:true`,
            ["literal", [((size / 2 + 4) * sponsorScale) / labelSize, 0]],
        ]),
        ["array", "number", 2, ["get", "labelOffset"]],
    ] as unknown as ExpressionSpecification;

    // scale sponsor offsets with their tiles while preserving ordinary and stacked markers
    const labelOffset = [
        "interpolate",
        ["linear"],
        ["zoom"],
        ...badgeScales.flatMap(([zoom, scale]) => [
            zoom,
            [
                "case",
                ["get", "isSponsor"],
                sponsorOffset,
                [">", ["get", "count"], 1],
                zoom >= 14.5
                    ? ["array", "number", 2, ["get", "labelOffset"]]
                    : [
                          "case",
                          ["get", "isLogo"],
                          ["array", "number", 2, ["get", "labelOffset"]],
                          ["literal", [(groupSize / 2 + 4) / labelSize, 0]],
                      ],
                ["get", "isLogo"],
                ["array", "number", 2, ["get", "labelOffset"]],
                ["literal", [((badgeSize * scale) / 2 + 4) / labelSize, 0]],
            ],
        ]),
    ] as unknown as ExpressionSpecification;

    // keep ordinary zoom scaling and hero dots unchanged
    const iconSize: ExpressionSpecification = isLabelled
        ? ([
              "interpolate",
              ["linear"],
              ["zoom"],
              ...badgeScales.flatMap(([zoom, scale]) => [
                  zoom,
                  [
                      "case",
                      ["get", "isSponsor"],
                      sponsorScale,
                      ["any", ["get", "isLogo"], [">", ["get", "count"], 1]],
                      1,
                      scale,
                  ],
              ]),
          ] as unknown as ExpressionSpecification)
        : ["case", ["get", "isSponsor"], sponsorScale, ["get", "isLogo"], 1, 0.4];

    return { "icon-size": iconSize, "text-offset": labelOffset };
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
                .flatMap((place) =>
                    place.organisations.filter(
                        (person) => place.organisations.length === 1 || person.isSponsor,
                    ),
                )
                .map((person) => [badgeId(person), person]),
        ).values(),
    ].filter((person) => !map.hasImage(badgeId(person)));
    // draw identical placeholders once; MapLibre copies pixels into each independent image id
    const initials = new Map<string, ImageData>();
    for (const person of missing) {
        const initial = `${person.name.slice(0, 1).toUpperCase()}:${person.isSponsor ?? false}:${person.recognition ?? ""}:${organisationSize(person)}`;
        let image = initials.get(initial);
        if (!image) {
            image = drawBadge(person);
            initials.set(initial, image);
        }
        map.addImage(badgeId(person), image, { pixelRatio });
    }

    // load only the three ranked logos at shared addresses, keeping one anchored canvas marker
    const stacks = places
        .filter(
            (place) =>
                place.organisations.length > 1 &&
                !place.organisations.some((person) => person.isSponsor) &&
                !map.hasImage(`stack:${place.id}`),
        )
        .map((place) => ({ id: `stack:${place.id}`, people: stackOrganisations(place) }))
        .filter((stack) => stack.people.length > 0);
    const loaded = new Map<string, HTMLImageElement>();
    const consumers = new Map<string, typeof stacks>();
    for (const stack of stacks) {
        map.addImage(stack.id, drawStack(stack.people, loaded), { pixelRatio });
        for (const person of stack.people) {
            const groups = consumers.get(person.id) ?? [];
            groups.push(stack);
            consumers.set(person.id, groups);
        }
    }
    const downloads = [
        ...new Map(
            [...missing, ...stacks.flatMap((stack) => stack.people)].map((person) => [
                person.id,
                person,
            ]),
        ).values(),
    ];

    // bound downloads and decoding rather than flooding a phone with every logo at once
    let next = 0;
    await Promise.all(
        Array.from({ length: Math.min(6, downloads.length) }, async () => {
            while (next < downloads.length && isActive()) {
                const person = downloads[next++];
                const source = person.mapLogoUrl ?? person.logoUrl;
                if (!source) continue;
                const image = await loadImage(source, isActive);
                if (image && isActive()) {
                    if (map.hasImage(badgeId(person)))
                        map.updateImage(badgeId(person), drawBadge(person, image));
                    loaded.set(person.id, image);
                    for (const stack of consumers.get(person.id) ?? [])
                        map.updateImage(stack.id, drawStack(stack.people, loaded));
                }
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
            const sponsor = place.organisations.find((person) => person.isSponsor);
            const organisation = sponsor ?? place.organisations[0];
            const isGroup = place.organisations.length > 1;
            const stack = isGroup ? stackOrganisations(place) : [];
            const highlighted =
                stack.find((person) => isHighlighted(person, place)) ??
                place.organisations.find((person) => isHighlighted(person, place));
            const isLogo = Boolean(sponsor || highlighted);
            const size = isGroup && !sponsor ? groupSize : organisationSize(organisation);
            const hasStack = stack.length > 0 && !sponsor;

            return {
                type: "Feature",
                geometry: { type: "Point", coordinates: [place.longitude, place.latitude] },
                properties: {
                    id: place.organisations.length > 1 ? place.id : place.organisations[0].id,
                    place: place.id,
                    name:
                        place.organisations.length > 1
                            ? (sponsor?.name ?? highlighted?.name ?? placeName(place))
                            : place.organisations[0].name,
                    badge: sponsor
                        ? badgeId(sponsor)
                        : hasStack
                          ? `stack:${place.id}`
                          : isGroup
                            ? "group-dot"
                            : badgeId(organisation),
                    count: place.organisations.length,
                    isLogo,
                    isSponsor: place.organisations.some((person) => Boolean(person.isSponsor)),
                    labelOffset: [((hasStack ? stackWidth : size) / 2 + 4) / labelSize, 0],
                    ring: sponsor
                        ? `ring:${size}:true`
                        : isGroup
                          ? hasStack && isLogo
                              ? "ring-stack"
                              : "ring-group"
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
    if (organisation.isSponsor) return sponsorSizes[organisation.prominence];

    return organisation.recognition ? prominentSizes[organisation.prominence] : badgeSize;
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

/** Draw one compact overview dot for a shared address. */
function drawGroup() {
    const { canvas, context, radius } = createCanvas(groupSize);
    context.fillStyle = "#174ed8";
    context.beginPath();
    context.arc(radius, radius, 5 * pixelRatio, 0, Math.PI * 2);
    context.fill();

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

/** Draw a single shared-address marker with up to three overlapping real logos. */
function drawStack(people: Organisation[], images: Map<string, HTMLImageElement>) {
    const { canvas, context } = createCanvas(44, stackWidth);
    const width = 28 + (people.length - 1) * 18;
    const left = (stackWidth - width) / 2;

    // draw the highest-ranked organisation last so its logo stays unobscured
    for (let index = people.length - 1; index >= 0; index--) {
        const person = people[index];
        const image = images.get(person.id);
        const x = (left + 14 + index * 18) * pixelRatio;
        const y = 22 * pixelRatio;
        const radius = 14;
        context.fillStyle = "#ffffff";
        context.beginPath();
        context.arc(x, y, (radius + 2) * pixelRatio, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = person.recognition === "Host" ? "#174ed8" : "#bbc8df";
        context.beginPath();
        context.arc(x, y, radius * pixelRatio, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = image ? logoBackground(image) : "#ffffff";
        context.beginPath();
        context.arc(x, y, (radius - 2) * pixelRatio, 0, Math.PI * 2);
        context.fill();

        // fit the complete logo inside its circle without downloading any other tenants
        if (image) {
            const scale = (radius * 1.5 * pixelRatio) / Math.max(image.width, image.height);
            context.save();
            context.clip();
            context.drawImage(
                image,
                x - (image.width * scale) / 2,
                y - (image.height * scale) / 2,
                image.width * scale,
                image.height * scale,
            );
            context.restore();
        }
    }

    return context.getImageData(0, 0, canvas.width, canvas.height);
}

/** Draw a complete logo or initial inside a round host badge or rounded sponsor square. */
function drawBadge(organisation: Organisation, image?: HTMLImageElement) {
    const { canvas, context, radius } = createCanvas(organisationSize(organisation));

    // distinguish sponsors with a stronger square outline while hosts retain a fine round edge
    const halo = organisation.isSponsor ? 4 * pixelRatio : 0;
    const border = (organisation.isSponsor ? 7 : 1) * pixelRatio;
    if (organisation.isSponsor) {
        context.fillStyle = "#ffffff";
        context.beginPath();
        context.roundRect(
            2 * pixelRatio,
            2 * pixelRatio,
            canvas.width - 4 * pixelRatio,
            canvas.height - 4 * pixelRatio,
            8 * pixelRatio,
        );
        context.fill();
    }
    context.fillStyle = organisation.isSponsor
        ? (sponsorColours[organisation.recognition ?? ""] ?? "#174ed8")
        : "#bbc8df";
    if (organisation.isSponsor) {
        context.shadowColor = context.fillStyle;
        context.shadowBlur = 4 * pixelRatio;
    }
    context.beginPath();
    if (organisation.isSponsor)
        context.roundRect(
            halo,
            halo,
            canvas.width - 2 * halo,
            canvas.height - 2 * halo,
            6 * pixelRatio,
        );
    else context.arc(radius, radius, radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = image ? logoBackground(image) : "#ffffff";
    context.beginPath();
    if (organisation.isSponsor)
        context.roundRect(
            border,
            border,
            canvas.width - 2 * border,
            canvas.height - 2 * border,
            4 * pixelRatio,
        );
    else context.arc(radius, radius, radius - pixelRatio, 0, Math.PI * 2);
    context.fill();

    // icon clipped to the disc, or the initial when there is none
    if (image) {
        const size = radius * (organisation.isSponsor ? 1.3 : 1.5);
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
function createCanvas(diameter: number, width = diameter) {
    const canvas = document.createElement("canvas");
    canvas.width = width * pixelRatio;
    canvas.height = diameter * pixelRatio;
    const context = canvas.getContext("2d")!;

    return { canvas, context, radius: canvas.width / 2 };
}
