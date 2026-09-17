import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import type { Map as GeographicMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { Arrow } from "../components/arrow";

/** Show the venue's surroundings and open directions to its exact location. */
export function VenueMap(props: {
    /** Venue name for the map's accessible title. */
    name: string;
    /** Geographic position in degrees. */
    coordinates: { latitude: number; longitude: number };
}) {
    let container!: HTMLDivElement;
    let map: GeographicMap | undefined;
    const [hasError, setError] = createSignal(false);
    const position = (): [number, number] => [
        props.coordinates.longitude,
        props.coordinates.latitude,
    ];
    const directions = () => {
        const { latitude, longitude } = props.coordinates;
        const query = new URLSearchParams({ api: "1", destination: `${latitude},${longitude}` });

        return `https://www.google.com/maps/dir/?${query}`;
    };

    // keep a reused venue card centred on its current location
    createEffect(() => {
        const coordinates = position();
        map?.jumpTo({ center: coordinates });
    });

    // request tiles only when the venue map enters the viewport
    onMount(() => {
        let isDisposed = false;
        const resize = new ResizeObserver(() => map?.resize());
        const theme = new MutationObserver(() => map?.setStyle(venueStyle(container)));
        theme.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });
        const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer.disconnect();
            void import("maplibre-gl")
                .then((library) => {
                    if (isDisposed) return;
                    library.setWorkerUrl(workerUrl);
                    map = new library.Map({
                        container,
                        center: position(),
                        zoom: 15,
                        interactive: false,
                        attributionControl: false,
                        fadeDuration: 0,
                        style: venueStyle(container),
                    });
                    map.getCanvas().tabIndex = -1;
                    map.getCanvas().setAttribute("aria-hidden", "true");
                    map.on("error", () => setError(true));
                    map.on("idle", () => {
                        if (map?.areTilesLoaded()) setError(false);
                    });
                    resize.observe(container);
                })
                .catch(() => {
                    if (!isDisposed) setError(true);
                });
        });
        observer.observe(container);
        onCleanup(() => {
            isDisposed = true;
            observer.disconnect();
            resize.disconnect();
            theme.disconnect();
            map?.remove();
        });
    });

    return (
        <div class="venue-map">
            <div class="venue-map__frame">
                <div ref={container} class="venue-map__canvas" />
                <a
                    class="venue-map__location"
                    href={directions()}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Directions to ${props.name}`}
                >
                    <span class="venue-map__pin" aria-hidden="true" />
                </a>
                <a
                    class="venue-map__credit"
                    href="/legal#licences"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    © OpenStreetMap · OpenFreeMap
                </a>
            </div>
            <Show when={hasError()}>
                <p role="status">Map unavailable.</p>
            </Show>
            <a class="text-link" href={directions()} target="_blank" rel="noopener noreferrer">
                Directions <Arrow direction="external" />
            </a>
        </div>
    );
}

/** Draw only the streets and waterways needed to place the venue. */
function venueStyle(container: HTMLElement): StyleSpecification {
    const colors = getComputedStyle(container);
    const color = (name: string) => colors.getPropertyValue(`--color-${name}`).trim();

    return {
        version: 8,
        sources: { geography: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
        layers: [
            { id: "background", type: "background", paint: { "background-color": color("paper") } },
            {
                id: "water",
                type: "fill",
                source: "geography",
                "source-layer": "water",
                paint: { "fill-color": color("wash") },
            },
            {
                id: "rivers",
                type: "line",
                source: "geography",
                "source-layer": "waterway",
                paint: { "line-color": color("line"), "line-width": 2 },
            },
            {
                id: "streets",
                type: "line",
                source: "geography",
                "source-layer": "transportation",
                filter: ["!", ["in", ["get", "class"], ["literal", ["rail", "ferry", "path"]]]],
                paint: { "line-color": color("line"), "line-width": 2 },
            },
            {
                id: "railways",
                type: "line",
                source: "geography",
                "source-layer": "transportation",
                filter: ["==", ["get", "class"], "rail"],
                paint: { "line-color": color("line"), "line-width": 1, "line-dasharray": [2, 3] },
            },
        ],
    };
}
