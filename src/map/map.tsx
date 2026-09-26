import { FilterPills } from "../components/filter-pills";
import { organisationKinds } from "../../convex/organisations/kinds";
import { createEffect, createMemo, createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { Dynamic, render } from "solid-js/web";
import type { Map as GeographicMap, Marker, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { getMap, type MapLocation } from "./queries";
import { Image } from "../components/image";
import { useSearch } from "../search/local";
import { filterLocations } from "./filter";
import { Highlight } from "../components/highlight";
import { arrangeLogos } from "./placement";
import "./map.css";

/** Listing order of highlighted organisations. */
const prominence = { large: 0, medium: 1, small: 2 };

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
    const organisations = getMap.use(() => (props.isDecorative ? undefined : []));
    const [instance, setInstance] = createSignal<{ map: GeographicMap; Marker: typeof Marker }>();
    const [zoom, setZoom] = createSignal(12);
    const [error, setError] = createSignal(false);
    const { query: search, setQuery: setSearch, terms } = useSearch();
    const [category, setCategory] = createSignal("all");
    const [hovered, setHovered] = createSignal<string[]>([]);
    const [selected, setSelected] = createSignal<string[]>([]);
    const [selectedOrganisation, setSelectedOrganisation] = createSignal<string>();
    const [crowdedCount, setCrowdedCount] = createSignal(0);
    const [view, setView] = createSignal(0);
    const filtered = createMemo(() =>
        props.isHero
            ? (organisations() ?? [])
            : filterLocations(organisations() ?? [], category(), terms()),
    );
    const organisationCount = () =>
        filtered().reduce((sum, place) => sum + place.organisations.length, 0);

    // list hosts and sponsors first, then every other place by name
    const listed = createMemo(() =>
        [...filtered()].sort(
            (left, right) =>
                prominence[left.organisations[0].prominence] -
                    prominence[right.organisations[0].prominence] ||
                left.organisations[0].name.localeCompare(right.organisations[0].name),
        ),
    );
    const selectedPlaces = createMemo(() =>
        filtered()
            .filter((place) => selected().includes(place.id))
            .map((place) => ({
                ...place,
                organisations: place.organisations.filter(
                    (person) => !selectedOrganisation() || person.id === selectedOrganisation(),
                ),
            })),
    );
    let container!: HTMLDivElement;
    let closeButton: HTMLButtonElement | undefined;
    let backButton: HTMLButtonElement | undefined;

    /** Return keyboard focus to the map after dismissing location details. */
    function closeDetails() {
        setSelected([]);
        instance()?.map.getCanvas().focus({ preventScroll: true });
    }

    /** Keep selection shared between the markers and the directory. */
    function select(places: MapLocation[]) {
        setSelectedOrganisation(
            places.length === 1 && places[0].organisations.length === 1
                ? places[0].organisations[0].id
                : undefined,
        );
        setSelected(places.map((place) => place.id));
        const map = instance()?.map;
        const first = places[0];
        if (map && first && !map.getBounds().contains([first.longitude, first.latitude])) {
            map.easeTo({ center: [first.longitude, first.latitude], duration: 400 });
        }
        queueMicrotask(() =>
            (window.matchMedia("(max-width: 800px)").matches ? closeButton : backButton)?.focus({
                preventScroll: true,
            }),
        );
    }

    /** Fit the full city extent on every screen size and restore it on reset. */
    function frame() {
        setSelected([]);
        instance()?.map.fitBounds(
            props.isHero
                ? [
                      [8.4, 47.3],
                      [8.68, 47.46],
                  ]
                : [
                      [8.44, 47.32],
                      [8.64, 47.44],
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

    // Place individual logos without hiding organisations at shared or nearby addresses.
    createEffect(() => {
        const current = instance();
        const entries = filtered();
        view();
        if (!current) return;
        const logos = arrangeLogos(
            entries.flatMap((place) => {
                const point = current.map.project([place.longitude, place.latitude]);
                return place.organisations.map((person) => ({
                    id: `${place.id}:${person.id}`,
                    ...point,
                    size: { large: 36, medium: 30, small: 26 }[person.prominence],
                    place,
                    person,
                }));
            }),
            { width: container.clientWidth, height: container.clientHeight },
        );
        setCrowdedCount(logos.crowded.length);
        const markers = logos.placed.map(({ place: anchor, person: first, size, offset }) => {
            const places = [{ ...anchor, organisations: [first] }];
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
                            "map-pin--hovered": hovered().includes(first.id),
                            "map-pin--selected": places.some(
                                (place) =>
                                    selected().includes(place.id) &&
                                    (!selectedOrganisation() ||
                                        selectedOrganisation() === first.id),
                            ),
                        }}
                        style={{
                            "--map-logo-size": `${size - 4}px`,
                        }}
                        aria-label={`${first.name} — ${anchor.address}`}
                        aria-pressed={
                            props.isHero
                                ? undefined
                                : places.some((place) => selected().includes(place.id)) &&
                                  (!selectedOrganisation() || selectedOrganisation() === first.id)
                        }
                        onPointerEnter={() => setHovered([first.id])}
                        onPointerLeave={() => setHovered([])}
                        onFocus={() => setHovered([first.id])}
                        onBlur={() => setHovered([])}
                        onClick={() => {
                            if (!props.isHero) select(places);
                        }}
                    >
                        <span class="map-pin__logos">
                            <span class="map-logo">
                                <Show
                                    when={first.mapLogoUrl ?? first.logoUrl}
                                    fallback={first.name.slice(0, 1)}
                                >
                                    {(source) => <img src={source()} alt="" />}
                                </Show>
                            </span>
                        </span>
                    </Dynamic>
                ),
                element,
            );
            // draw a fine connector back to the unchanged geographic anchor
            const distance = Math.hypot(...offset);
            if (distance > 0) {
                const connector = document.createElement("span");
                connector.className = "map-connector";
                connector.style.width = `${distance}px`;
                connector.style.transform = `rotate(${Math.atan2(-offset[1], -offset[0])}rad)`;
                element.prepend(connector);
            }
            const marker = new current.Marker({ element, offset })
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
                        <header class="map-directory-heading">
                            <h1>Map</h1>
                            <a class="action-link" href="/manage">
                                Add your organisation
                            </a>
                        </header>
                        <label class="map-search">
                            <input
                                class="field__control"
                                type="search"
                                aria-label="Search organisations or addresses"
                                value={search()}
                                placeholder="Search the map…"
                                onInput={(event) => {
                                    setSearch(event.currentTarget.value);
                                    setSelected([]);
                                }}
                            />
                        </label>
                        <div class="map-filters">
                            <FilterPills
                                label="Organisation category"
                                value={category()}
                                options={[
                                    { value: "all", label: "All" },
                                    ...Object.entries(organisationKinds)
                                        .filter(([kind]) =>
                                            organisations()?.some((place) =>
                                                place.organisations.some(
                                                    (entry) => entry.kind === kind,
                                                ),
                                            ),
                                        )
                                        .map(([value, label]) => ({ value, label })),
                                ]}
                                onChange={(value) => {
                                    setCategory(value);
                                    setSelected([]);
                                    setHovered([]);
                                }}
                            />
                        </div>
                        <Show
                            when={selectedPlaces().length}
                            fallback={
                                <>
                                    <p class="map-results" role="status">
                                        {organisations() === undefined
                                            ? "Loading locations…"
                                            : `${organisationCount()} organisation${organisationCount() === 1 ? "" : "s"}`}
                                    </p>
                                    <Show
                                        when={organisations() !== undefined && !filtered().length}
                                    >
                                        <p class="map-empty">No locations match your search.</p>
                                    </Show>
                                    <Show when={crowdedCount() > 0}>
                                        <p class="map-results" role="status">
                                            Map is crowded. {crowdedCount()} additional
                                            organisations are listed below.
                                        </p>
                                    </Show>
                                    <For each={listed()}>
                                        {(place) => (
                                            <button
                                                class="map-location-row"
                                                classList={{
                                                    "is-hovered": place.organisations.some(
                                                        (person) => hovered().includes(person.id),
                                                    ),
                                                }}
                                                onPointerEnter={() =>
                                                    setHovered(
                                                        place.organisations.map(
                                                            (person) => person.id,
                                                        ),
                                                    )
                                                }
                                                onPointerLeave={() => setHovered([])}
                                                onFocus={() =>
                                                    setHovered(
                                                        place.organisations.map(
                                                            (person) => person.id,
                                                        ),
                                                    )
                                                }
                                                onBlur={() => setHovered([])}
                                                type="button"
                                                onClick={() => select([place])}
                                            >
                                                <span class="map-row-logo">
                                                    <Show
                                                        when={
                                                            place.organisations[0].mapLogoUrl ??
                                                            place.organisations[0].logoUrl
                                                        }
                                                        fallback={place.organisations[0].name.slice(
                                                            0,
                                                            1,
                                                        )}
                                                    >
                                                        {(source) => (
                                                            <Image
                                                                src={source()}
                                                                darkSrc={
                                                                    place.organisations[0]
                                                                        .mapLogoDarkUrl
                                                                }
                                                                alt=""
                                                            />
                                                        )}
                                                    </Show>
                                                </span>
                                                <span class="map-row-copy">
                                                    <strong>
                                                        <Highlight
                                                            text={place.organisations
                                                                .map((person) => person.name)
                                                                .join(" · ")}
                                                            terms={terms()}
                                                        />
                                                    </strong>
                                                    <small>
                                                        <Show
                                                            when={
                                                                place.organisations[0].recognition
                                                            }
                                                        >
                                                            {(recognition) => (
                                                                <span class="tag tag-status tag-emphasis">
                                                                    {recognition()}
                                                                </span>
                                                            )}
                                                        </Show>
                                                        {
                                                            organisationKinds[
                                                                place.organisations[0].kind
                                                            ]
                                                        }
                                                        {" · "}
                                                        {place.address.split(", ").at(-1)}
                                                    </small>
                                                </span>
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
                                    <small>{organisationKinds[organisation.kind]}</small>
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
