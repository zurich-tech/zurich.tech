import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import type { Map as GeographicMap, Marker } from "maplibre-gl";
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
    let marker: Marker | undefined;
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
        marker?.setLngLat(coordinates);
    });

    // request tiles only when the venue map enters the viewport
    onMount(() => {
        let isDisposed = false;
        const resize = new ResizeObserver(() => map?.resize());
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
                        maxZoom: 19,
                        attributionControl: false,
                        dragRotate: false,
                        pitchWithRotate: false,
                        touchPitch: false,
                        scrollZoom: false,
                        fadeDuration: 0,
                        style: {
                            version: 8,
                            sources: {
                                streets: {
                                    type: "raster",
                                    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                                    tileSize: 256,
                                    maxzoom: 19,
                                },
                            },
                            layers: [{ id: "streets", type: "raster", source: "streets" }],
                        },
                    });
                    map.touchZoomRotate.disableRotation();
                    map.getCanvas().setAttribute("aria-label", `Map showing ${props.name}`);
                    map.addControl(
                        new library.NavigationControl({ showCompass: false }),
                        "top-right",
                    );
                    marker = new library.Marker({ color: "#174ed8" })
                        .setLngLat(position())
                        .addTo(map);
                    marker.getElement().setAttribute("aria-label", props.name);
                    map.on("error", () => setError(true));
                    map.on("idle", () => {
                        if (map?.areTilesLoaded()) setError(false);
                    });
                    resize.observe(container);
                })
                .catch(() => setError(true));
        });
        observer.observe(container);
        onCleanup(() => {
            isDisposed = true;
            observer.disconnect();
            resize.disconnect();
            map?.remove();
        });
    });

    return (
        <div class="venue-map">
            <div class="venue-map__frame">
                <div ref={container} class="venue-map__canvas" />
                <a
                    class="venue-map__credit"
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    © OpenStreetMap contributors
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
