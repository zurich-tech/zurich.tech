import { createAsync } from "@solidjs/router";
import { createEffect, createSignal, onMount, onCleanup, Show } from "solid-js";
import { render } from "solid-js/web";
import type { Map as GeographicMap, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { getMap } from "../core/queries";
import { Image } from "./image";

/** Keep the circuit-map palette while fetching geographic detail at each zoom. */
const style: StyleSpecification = {
    version: 8,
    sources: { geography: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
    layers: [
        { id: "background", type: "background", paint: { "background-color": "#174ed8" } },
        {
            id: "water",
            type: "fill",
            source: "geography",
            "source-layer": "water",
            paint: { "fill-color": "#4170df", "fill-outline-color": "#ffffff" },
        },
        {
            id: "rivers",
            type: "line",
            source: "geography",
            "source-layer": "waterway",
            paint: { "line-color": "#ffffff", "line-opacity": 0.7, "line-width": 1 },
        },
        {
            id: "roads",
            type: "line",
            source: "geography",
            "source-layer": "transportation",
            filter: ["!=", ["get", "class"], "rail"],
            paint: {
                "line-color": "#ffffff",
                "line-opacity": 0.8,
                "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.45, 13, 1, 17, 2],
            },
        },
        {
            id: "railways",
            type: "line",
            source: "geography",
            "source-layer": "transportation",
            filter: ["==", ["get", "class"], "rail"],
            paint: {
                "line-color": "#ffffff",
                "line-opacity": 0.9,
                "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 13, 1.3, 17, 2.5],
            },
        },
    ],
};

/** Load continuous geography, with a wider noninteractive view for page banners. */
export function CommunityMap(props: {
    /** Frame the wider Zürich area and link the background to the map page. */
    isHero?: boolean;
    /** Hide organisation markers on inner-page banners. */
    isDecorative?: boolean;
}) {
    const organisations = createAsync(() => (props.isDecorative ? Promise.resolve([]) : getMap()));
    const [instance, setInstance] = createSignal<{ map: GeographicMap; Marker: typeof Marker }>();
    const [zoom, setZoom] = createSignal(12);
    const [error, setError] = createSignal(false);
    let container!: HTMLDivElement;

    /** Fit the full city extent on every screen size and restore it on reset. */
    function frame() {
        instance()?.map.fitBounds(
            props.isHero
                ? [
                      [8.4, 47.3],
                      [8.68, 47.46],
                  ]
                : [
                      [8.47, 47.33],
                      [8.6, 47.44],
                  ],
            { padding: props.isHero ? 0 : 64, duration: 0 },
        );
    }

    // Load WebGL only in the browser and dispose it when navigating away.
    onMount(() => {
        let isDisposed = false;
        let map: GeographicMap | undefined;
        const observer = new ResizeObserver(() => {
            map?.resize();
            if (props.isHero) frame();
        });
        observer.observe(container);
        onCleanup(() => {
            isDisposed = true;
            observer.disconnect();
            map?.remove();
        });

        // The same source serves both banners and the fully interactive map.
        void import("maplibre-gl")
            .then((library) => {
                if (isDisposed) return;
                library.setWorkerUrl(workerUrl);
                map = new library.Map({
                    container,
                    style,
                    center: [8.54, 47.385],
                    zoom: 12,
                    minZoom: 3,
                    maxZoom: 18,
                    interactive: !props.isHero,
                    dragRotate: false,
                    pitchWithRotate: false,
                    touchPitch: false,
                    attributionControl: false,
                });
                map.touchZoomRotate.disableRotation();
                map.getCanvas().setAttribute("aria-label", "Zürich community map");
                if (props.isHero) map.getCanvas().tabIndex = -1;
                map.on("zoom", () => setZoom(map!.getZoom()));
                map.on("error", () => setError(true));
                map.on("idle", () => {
                    if (map!.areTilesLoaded()) setError(false);
                });
                setInstance({ map, Marker: library.Marker });
                frame();
            })
            .catch(() => {
                if (!isDisposed) setError(true);
            });
    });

    // Keep linked logos attached to real coordinates as tiles and zoom change.
    createEffect(() => {
        const current = instance();
        const entries = organisations() ?? [];
        if (!current) return;
        const markers = entries.map((organisation) => {
            const element = document.createElement("div");
            const diameter =
                organisation.tier === "principal" ? 40 : organisation.tier === "partner" ? 32 : 26;
            const dispose = render(
                () => (
                    <a
                        class="map-organisation"
                        href={`/organisations/${organisation.slug}`}
                        aria-label={`${organisation.name} — ${organisation.location}`}
                        style={{ width: `${diameter}px`, height: `${diameter}px` }}
                    >
                        <Show
                            when={organisation.mapLogoUrl ?? organisation.logoUrl}
                            fallback={<span class="map-organisation-dot" />}
                        >
                            {(source) => (
                                <Image
                                    src={source()}
                                    darkSrc={organisation.mapLogoDarkUrl}
                                    alt=""
                                />
                            )}
                        </Show>
                        <span class="map-organisation-label">{organisation.name}</span>
                    </a>
                ),
                element,
            );
            const marker = new current.Marker({ element })
                .setLngLat([organisation.longitude, organisation.latitude])
                .addTo(current.map);
            return { marker, dispose };
        });
        onCleanup(() =>
            markers.forEach(({ marker, dispose }) => {
                marker.remove();
                dispose();
            }),
        );
    });

    return (
        <div class="community-map" classList={{ "community-map--hero": props.isHero }}>
            <div ref={container} class="map-canvas" />
            <Show when={props.isHero}>
                <a class="map-explore" href="/map" aria-label="Explore the community map" />
            </Show>
            <Show when={error()}>
                <p class="map-error" role="status">
                    Map tiles could not load. Check your connection and reload.
                </p>
            </Show>
            <Show when={!props.isHero}>
                <a class="button map-directory" href="/organisations">
                    Organisations
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 12h14m-6-6 6 6-6 6" />
                    </svg>
                </a>
                <div class="map-controls" role="group" aria-label="Map controls">
                    <button
                        class="map-control"
                        type="button"
                        onClick={() => instance()?.map.zoomIn()}
                        disabled={!instance() || zoom() >= 18}
                        aria-label="Zoom in"
                        title="Zoom in"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 12h14M12 5v14" />
                        </svg>
                    </button>
                    <button
                        class="map-control"
                        type="button"
                        onClick={() => instance()?.map.zoomOut()}
                        disabled={!instance() || zoom() <= 3}
                        aria-label="Zoom out"
                        title="Zoom out"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M5 12h14" />
                        </svg>
                    </button>
                    <button
                        class="map-control"
                        type="button"
                        onClick={() => {
                            frame();
                        }}
                        aria-label="Reset map view"
                        title="Reset map view"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                </div>
            </Show>
            <Show when={!props.isHero}>
                <a
                    class="map-attribution"
                    href="/legal#licences"
                    aria-label="Map credits and licences"
                >
                    © OpenStreetMap · OpenFreeMap
                </a>
            </Show>
        </div>
    );
}
