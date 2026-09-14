import { createAsync } from "@solidjs/router";
import { createEffect, createMemo, createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { Dynamic, render } from "solid-js/web";
import type { Map as GeographicMap, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { getMap } from "./queries";
import { Image } from "../components/image";
import { useSearch } from "../search/local";
import { matchesSearch } from "../search/search";
import { Highlight } from "../components/highlight";
import { clusterLocations } from "./clusters";
import "./map.css";

type MapLocation = Awaited<ReturnType<typeof getMap>>[number];

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
            paint: { "fill-color": "#5b8bdf", "fill-outline-color": "#83a6eb" },
        },
        {
            id: "rivers",
            type: "line",
            source: "geography",
            "source-layer": "waterway",
            paint: { "line-color": "#ffffff", "line-opacity": 0.35, "line-width": 1 },
        },
        {
            id: "roads",
            type: "line",
            source: "geography",
            "source-layer": "transportation",
            filter: ["!", ["in", ["get", "class"], ["literal", ["rail", "ferry"]]]],
            paint: {
                "line-color": "#ffffff",
                "line-opacity": [
                    "match",
                    ["get", "class"],
                    ["motorway", "trunk", "primary"],
                    0.48,
                    0.16,
                ],
                "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.3, 13, 0.7, 17, 1.5],
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
                "line-opacity": 0.18,
                "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.3, 13, 0.65, 17, 1.2],
            },
        },
    ],
};

/** Load continuous geography, with a wider noninteractive view for page banners. */
export function CommunityMap(props: {
    /** Frame the wider Zurich area and link the background to the map page. */
    isHero?: boolean;
    /** Hide organisation markers on inner-page banners. */
    isDecorative?: boolean;
}) {
    const organisations = createAsync(() => (props.isDecorative ? Promise.resolve([]) : getMap()));
    const [instance, setInstance] = createSignal<{ map: GeographicMap; Marker: typeof Marker }>();
    const [zoom, setZoom] = createSignal(12);
    const [error, setError] = createSignal(false);
    const { query: search, setQuery: setSearch, terms } = useSearch();
    const [selected, setSelected] = createSignal<string[]>([]);
    const [view, setView] = createSignal(0);
    const filtered = createMemo(() =>
        (organisations() ?? []).filter(
            (place) =>
                props.isHero ||
                matchesSearch(
                    [
                        place.address,
                        ...place.organisations.flatMap((entry) => [
                            entry.name,
                            entry.headline ?? "",
                        ]),
                    ].join(" "),
                    terms(),
                ),
        ),
    );
    const organisationCount = () =>
        filtered().reduce((sum, place) => sum + place.organisations.length, 0);
    const selectedPlaces = createMemo(() =>
        filtered().filter((place) => selected().includes(place.id)),
    );
    let container!: HTMLDivElement;
    let closeButton: HTMLButtonElement | undefined;
    let backButton: HTMLButtonElement | undefined;

    /** Return keyboard focus to the map after dismissing location details. */
    function closeDetails() {
        setSelected([]);
        instance()?.map.getCanvas().focus({ preventScroll: true });
    }

    /** Fit real locations with room for their labels, retaining a city view when empty. */
    function fit(places: MapLocation[]) {
        if (!places.length) return;
        instance()?.map.fitBounds(
            [
                [
                    Math.min(...places.map((place) => place.longitude)),
                    Math.min(...places.map((place) => place.latitude)),
                ],
                [
                    Math.max(...places.map((place) => place.longitude)),
                    Math.max(...places.map((place) => place.latitude)),
                ],
            ],
            { padding: { top: 90, right: 115, bottom: 90, left: 115 }, maxZoom: 14, duration: 0 },
        );
    }

    /** Keep selection shared between the markers and the directory. */
    function select(places: MapLocation[]) {
        setSelected(places.map((place) => place.id));
        fit(places);
        queueMicrotask(() =>
            (window.matchMedia("(max-width: 800px)").matches ? closeButton : backButton)?.focus({
                preventScroll: true,
            }),
        );
    }

    /** Fit the full city extent on every screen size and restore it on reset. */
    function frame() {
        setSelected([]);
        if (!props.isHero && filtered().length) {
            fit(filtered());
            return;
        }
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
            setView((value) => value + 1);
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
                map.getCanvas().setAttribute("aria-label", "Zurich map");
                if (props.isHero) map.getCanvas().tabIndex = -1;
                map.on("moveend", () => setView((value) => value + 1));
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

    // Reframe when the searchable set changes, rather than on ordinary map movement.
    createEffect(() => {
        const current = instance();
        const places = filtered();
        if (current && !props.isHero && places.length) fit(places);
    });

    // Group screen-space collisions; shared addresses remain one location at every zoom.
    createEffect(() => {
        const current = instance();
        const entries = filtered();
        view();
        if (!current) return;
        const groups = clusterLocations(
            entries,
            (place) => current.map.project([place.longitude, place.latitude]),
            props.isHero ? 64 : 210,
        );
        const markers = groups.map((places) => {
            const anchor = places[0];
            const people = places.flatMap((place) => place.organisations);
            const first = people[0];
            const label =
                places.length > 1
                    ? `${places.length} locations`
                    : people.length > 1
                      ? `${first.name} +${people.length - 1}`
                      : first.name;
            const element = document.createElement("div");
            const dispose = render(
                () => (
                    <Dynamic
                        component={props.isHero ? "a" : "button"}
                        href={props.isHero ? "/map" : undefined}
                        type={props.isHero ? undefined : "button"}
                        class="map-pin"
                        classList={{
                            "map-pin--hero": props.isHero,
                            "map-pin--selected": places.some((place) =>
                                selected().includes(place.id),
                            ),
                        }}
                        style={{
                            "--map-logo-size": `${{ large: 40, medium: 34, small: 30 }[people.some((person) => person.prominence === "large") ? "large" : people.some((person) => person.prominence === "medium") ? "medium" : "small"]}px`,
                        }}
                        aria-label={`${people.map((person) => person.name).join(", ")} — ${places.length > 1 ? `${places.length} locations` : anchor.address}`}
                        aria-pressed={
                            props.isHero
                                ? undefined
                                : places.some((place) => selected().includes(place.id))
                        }
                        onClick={() => {
                            if (!props.isHero) select(places);
                        }}
                    >
                        <span class="map-pin__logos">
                            <For each={people.slice(0, 2)}>
                                {(person) => (
                                    <span class="map-logo">
                                        <Show
                                            when={person.mapLogoUrl ?? person.logoUrl}
                                            fallback={person.name.slice(0, 1)}
                                        >
                                            {(source) => <img src={source()} alt="" />}
                                        </Show>
                                    </span>
                                )}
                            </For>
                        </span>
                        <span class="map-pin__label">
                            <Highlight text={label} terms={props.isHero ? [] : terms()} />
                        </span>
                        <Show when={props.isHero && people.length > 1}>
                            <span class="map-pin__count">{people.length}</span>
                        </Show>
                    </Dynamic>
                ),
                element,
            );
            const marker = new current.Marker({ element })
                .setLngLat([anchor.longitude, anchor.latitude])
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
        <div
            classList={{ "map-explorer": !props.isHero }}
            onKeyDown={(event) => {
                if (event.key === "Escape" && selected().length) {
                    event.stopPropagation();
                    closeDetails();
                }
            }}
        >
            <Show when={!props.isHero}>
                <header class="map-heading">
                    <div>
                        <h1>Our community</h1>
                        <p>Discover the people and organisations building in Zurich.</p>
                    </div>
                    <a href="/organisations">All organisations ↗</a>
                </header>
            </Show>
            <div classList={{ "map-layout": !props.isHero }}>
                <div class="community-map" classList={{ "community-map--hero": props.isHero }}>
                    <div ref={container} class="map-canvas" />
                    <Show when={props.isHero}>
                        <a class="map-explore" href="/map" aria-label="Explore the map" />
                    </Show>
                    <Show when={error()}>
                        <p class="map-error" role="status">
                            Map tiles could not load. Check your connection and reload.
                        </p>
                    </Show>
                    <Show when={!props.isHero}>
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
                    <Show when={!props.isHero && selectedPlaces().length}>
                        <section class="map-sheet" aria-label="Selected location">
                            <header>
                                <strong>
                                    {selectedPlaces().length === 1
                                        ? "At this location"
                                        : `${selectedPlaces().length} locations`}
                                </strong>
                                <button
                                    type="button"
                                    aria-label="Close location details"
                                    ref={closeButton}
                                    onClick={closeDetails}
                                >
                                    Close ×
                                </button>
                            </header>
                            <PlaceDetails places={selectedPlaces()} />
                        </section>
                    </Show>
                </div>
                <Show when={!props.isHero}>
                    <aside class="map-directory-panel" aria-label="Map directory">
                        <label class="map-search">
                            Search the map
                            <input
                                type="search"
                                value={search()}
                                placeholder="Organisation or address…"
                                onInput={(event) => {
                                    setSearch(event.currentTarget.value);
                                    setSelected([]);
                                }}
                            />
                        </label>
                        <Show
                            when={selectedPlaces().length}
                            fallback={
                                <>
                                    <p class="map-results" role="status">
                                        {organisations() === undefined
                                            ? "Loading locations…"
                                            : `${organisationCount()} organisation${organisationCount() === 1 ? "" : "s"} · ${filtered().length} location${filtered().length === 1 ? "" : "s"}`}
                                    </p>
                                    <Show
                                        when={organisations() !== undefined && !filtered().length}
                                    >
                                        <p class="map-empty">No locations match your search.</p>
                                    </Show>
                                    <For each={filtered()}>
                                        {(place) => (
                                            <button
                                                class="map-location-row"
                                                type="button"
                                                onClick={() => select([place])}
                                            >
                                                <strong>
                                                    <Highlight
                                                        text={place.organisations
                                                            .map((person) => person.name)
                                                            .join(" · ")}
                                                        terms={terms()}
                                                    />
                                                </strong>
                                                <span>
                                                    <Highlight
                                                        text={place.address}
                                                        terms={terms()}
                                                    />
                                                </span>
                                                <small>Show on map →</small>
                                            </button>
                                        )}
                                    </For>
                                </>
                            }
                        >
                            <div class="map-desktop-details">
                                <button
                                    class="map-back"
                                    type="button"
                                    ref={backButton}
                                    onClick={() => {
                                        frame();
                                        closeDetails();
                                    }}
                                >
                                    ← All locations
                                </button>
                                <PlaceDetails places={selectedPlaces()} />
                            </div>
                        </Show>
                    </aside>
                </Show>
            </div>
        </div>
    );
}

/** Present all organisations at a selected address without hiding smaller supporters. */
function PlaceDetails(detail: { places: MapLocation[] }) {
    return (
        <For each={detail.places}>
            {(place) => (
                <section class="map-place">
                    <p class="map-place__address">{place.address}</p>
                    <For each={place.organisations}>
                        {(organisation) => (
                            <a class="map-person" href={`/organisations/${organisation.slug}`}>
                                <span class="map-person__logo">
                                    <Show
                                        when={organisation.mapLogoUrl ?? organisation.logoUrl}
                                        fallback={organisation.name.slice(0, 1)}
                                    >
                                        {(source) => (
                                            <Image
                                                src={source()}
                                                darkSrc={organisation.mapLogoDarkUrl}
                                                alt=""
                                            />
                                        )}
                                    </Show>
                                </span>
                                <span>
                                    <strong>{organisation.name}</strong>
                                    <Show when={organisation.recognition}>
                                        <small>{organisation.recognition}</small>
                                    </Show>
                                    <Show when={organisation.headline}>
                                        <span>{organisation.headline}</span>
                                    </Show>
                                </span>
                                <span aria-hidden="true">↗</span>
                            </a>
                        )}
                    </For>
                </section>
            )}
        </For>
    );
}
