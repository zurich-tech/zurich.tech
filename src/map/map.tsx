import {
    Search,
    List,
    X,
    Plus,
    ArrowLeft,
    ArrowUpRight,
    ArrowRight,
    ChevronDown,
    ZoomIn,
    ZoomOut,
    LocateFixed,
} from "lucide-solid";
import { organisationKinds } from "../../convex/organisations/kinds";
import { createEffect, createMemo, createSignal, onMount, onCleanup, Show, For } from "solid-js";
import { Dynamic, render } from "solid-js/web";
import type { Map as GeographicMap, Marker, Popup, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { getMap, type MapLocation } from "./queries";
import { Image } from "../components/image";
import { SocialLinks } from "../components/social";
import { useSearch } from "../search/local";
import { searchTerms } from "../search/search";
import { filterLocations } from "./filter";
import { matchingPlaces, placeName, selectPlaces } from "./places";
import { Highlight } from "../components/highlight";
import { arrangeLogos } from "./placement";
import { overview } from "./camera";
import { logoBackground } from "./colour";
import { isPreviewPath, type Point } from "./hover";
import {
    addBadges,
    addOrganisationLayers,
    highlightOrganisations,
    showOrganisations,
} from "./layers";
import "./map.css";

/** Check whether an organisation earns a full logo on the map rather than a badge. */
function isHighlighted(organisation: MapLocation["organisations"][number]) {
    return Boolean(organisation.recognition);
}

/** Keep banners blue and give the interactive map a quieter geographic palette. */
function mapStyle(isHero: boolean): StyleSpecification {
    return {
        version: 8,
        glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
        sources: { geography: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
        layers: [
            {
                id: "background",
                type: "background",
                paint: { "background-color": isHero ? "#174ed8" : "#edf0f2" },
            },
            {
                id: "water",
                type: "fill",
                source: "geography",
                "source-layer": "water",
                paint: {
                    "fill-color": isHero ? "#5b8bdf" : "#a8c7ef",
                    "fill-outline-color": isHero ? "#83a6eb" : "#8eb5e7",
                },
            },
            {
                id: "rivers",
                type: "line",
                source: "geography",
                "source-layer": "waterway",
                paint: {
                    "line-color": isHero ? "#ffffff" : "#8eb5e7",
                    "line-opacity": isHero ? 0.35 : 1,
                    "line-width": 1,
                },
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
                        isHero ? 0.24 : 1,
                        isHero ? 0 : 0.8,
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
                    "line-color": isHero ? "#ffffff" : "#8c99a8",
                    "line-opacity": isHero ? 0.08 : 0.18,
                    "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.3, 13, 0.65, 17, 1.2],
                },
            },
        ],
    };
}

/** Load continuous geography, with a wider noninteractive view for page banners. */
export function CommunityMap(props: {
    /** Frame the wider Zurich area and link the background to the map page. */
    isHero?: boolean;
    /** Hide organisation markers on inner-page banners. */
    isDecorative?: boolean;
}) {
    const organisations = getMap.use(() => (props.isDecorative ? undefined : []));
    const [instance, setInstance] = createSignal<{
        map: GeographicMap;
        Marker: typeof Marker;
        Popup: typeof Popup;
    }>();
    const [zoom, setZoom] = createSignal(12);
    const [error, setError] = createSignal(false);
    const { query: search, setQuery: setSearch, terms } = useSearch();
    const [groupSearch, setGroupSearch] = createSignal("");
    const groupTerms = createMemo(() => searchTerms(groupSearch()));
    const [category, setCategory] = createSignal("all");
    const [isPanelOpen, setPanelOpen] = createSignal(false);
    const [hovered, setHovered] = createSignal<string[]>([]);
    const [selected, setSelected] = createSignal<string[]>([]);
    const [selectedOrganisation, setSelectedOrganisation] = createSignal<string>();
    const [crowded, setCrowded] = createSignal<Set<string>>(new Set(), {
        equals: (previous, next) =>
            previous.size === next.size && [...previous].every((id) => next.has(id)),
    });
    const [view, setView] = createSignal(0);
    const filtered = createMemo(() =>
        props.isHero
            ? (organisations() ?? [])
            : filterLocations(organisations() ?? [], category(), terms()),
    );
    const organisationCount = () =>
        filtered().reduce((sum, place) => sum + place.organisations.length, 0);
    const markers = createMemo(() => matchingPlaces(organisations() ?? [], filtered()));

    // list organisations alphabetically without separating supporters from other results
    const listed = createMemo(() =>
        filtered()
            .flatMap((place) =>
                place.organisations.map((person) => ({ ...place, organisations: [person] })),
            )
            .sort((left, right) =>
                left.organisations[0].name.localeCompare(right.organisations[0].name),
            ),
    );

    // keep the list to what the map currently shows
    const visible = createMemo(() => {
        view();
        const bounds = instance()?.map.getBounds();
        return bounds
            ? listed().filter((place) => bounds.contains([place.longitude, place.latitude]))
            : listed();
    });

    // narrow the selected places to the chosen organisation
    const selectedPlaces = createMemo(() =>
        selectPlaces(organisations() ?? [], selected(), selectedOrganisation()),
    );
    let container!: HTMLDivElement;
    let isDisposed = false;
    let backButton: HTMLButtonElement | undefined;
    let preview: Popup | undefined;
    let disposePreview: (() => void) | undefined;
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
    let previewKey: string | undefined;
    let previewOrigin: Point | undefined;
    let pointer: Point | undefined;

    /** Protect slow and diagonal movement from the marker to the card. */
    function isApproachingPreview() {
        const card = preview?.getElement().querySelector(".maplibregl-popup-content");

        return Boolean(
            card &&
            pointer &&
            previewOrigin &&
            isPreviewPath(pointer, previewOrigin, card.getBoundingClientRect()),
        );
    }

    /** Cancel a pending preview transition. */
    function keepPreview() {
        clearTimeout(previewTimer);
    }

    /** Remove the preview and its mounted content together. */
    function closePreview() {
        keepPreview();
        preview?.remove();
        disposePreview?.();
        preview = undefined;
        disposePreview = undefined;
        previewKey = undefined;
        previewOrigin = undefined;
        setHovered([]);
    }

    /** Allow the pointer to cross the gap between a marker and its preview. */
    function leavePreview() {
        if (!preview) closePreview();
        else {
            keepPreview();
            previewTimer = setTimeout(() => {
                const element = preview?.getElement();
                if (
                    isApproachingPreview() ||
                    element?.matches(":hover") ||
                    element?.contains(document.activeElement)
                )
                    return;
                closePreview();
            }, 250);
        }
    }

    /** Preview a marker without selecting it or moving keyboard focus. */
    function showPreview(places: MapLocation[], point: [number, number], isKeyboard = false) {
        const current = instance();
        if (props.isHero || !current || current.map.isMoving()) return;
        const key = places
            .map((place) => `${place.id}:${place.organisations.map((item) => item.id).join(",")}`)
            .join(";");
        if (key === previewKey) {
            if (preview) keepPreview();
            return;
        }
        if (!isKeyboard && isApproachingPreview()) return;
        closePreview();
        previewKey = key;
        const bounds = container.getBoundingClientRect();
        previewOrigin = { x: bounds.left + point[0], y: bounds.top + point[1] };
        setHovered(places.flatMap((place) => place.organisations.map((person) => person.id)));

        // anchor to the displayed marker, including displaced standalone logos
        const position = current.map.unproject(point);
        previewTimer = setTimeout(
            () => {
                const element = document.createElement("div");
                // balance up to two logo rows without reserving empty columns for smaller groups
                const tenants = places[0].organisations
                    .filter((person) => person.mapLogoUrl ?? person.logoUrl)
                    .slice(0, 14);
                const columns =
                    tenants.length > 7
                        ? Math.ceil(tenants.length / 2)
                        : Math.max(1, tenants.length);
                disposePreview = render(
                    () => (
                        <div
                            role="region"
                            aria-label="Organisation preview"
                            onPointerEnter={keepPreview}
                            onPointerLeave={leavePreview}
                            onFocusIn={keepPreview}
                            onFocusOut={(event) => {
                                if (
                                    !event.currentTarget.contains(
                                        event.relatedTarget as Node | null,
                                    )
                                )
                                    leavePreview();
                            }}
                        >
                            <Show
                                when={places[0].organisations.length > 1}
                                fallback={<PlaceDetails places={places} />}
                            >
                                <section class="map-place map-place--shared">
                                    <h2 class="map-place__name">{placeName(places[0])}</h2>
                                    <p class="map-place__address">{places[0].address}</p>
                                    <div
                                        class="map-tenants"
                                        style={{ "--map-tenant-columns": columns }}
                                        aria-label="Organisations at this address"
                                    >
                                        <For each={tenants}>
                                            {(person) => (
                                                <Image
                                                    src={person.mapLogoUrl ?? person.logoUrl}
                                                    alt={person.name}
                                                    title={person.name}
                                                    width={32}
                                                    height={32}
                                                />
                                            )}
                                        </For>
                                    </div>
                                    <button
                                        class="map-browse"
                                        type="button"
                                        onClick={() => select(places)}
                                    >
                                        View all {places[0].organisations.length} organisations{" "}
                                        <ArrowRight size={16} />
                                    </button>
                                </section>
                            </Show>
                        </div>
                    ),
                    element,
                );
                preview = new current.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    focusAfterOpen: false,
                    offset: 18,
                    maxWidth: "min(320px, calc(100vw - 32px))",
                    className: "map-preview",
                })
                    .setLngLat(position)
                    .setDOMContent(element)
                    .addTo(current.map);
            },
            isKeyboard ? 0 : 180,
        );
    }

    /** Locate a keyboard or pointer-targeted logo within the map viewport. */
    function previewLogo(places: MapLocation[], element: HTMLElement, isKeyboard = false) {
        const marker = element.getBoundingClientRect();
        const map = container.getBoundingClientRect();
        showPreview(
            places,
            [marker.x + marker.width / 2 - map.x, marker.y + marker.height / 2 - map.y],
            isKeyboard,
        );
    }

    // discard previews whose contents no longer match the active filters
    createEffect(() => {
        filtered();
        closePreview();
    });

    /** Return keyboard focus to the map after dismissing location details. */
    function closeDetails() {
        setSelected([]);
        setHovered([]);
        instance()?.map.getCanvas().focus({ preventScroll: true });
    }

    /** Keep a chosen address visible beside the desktop panel or above the mobile sheet. */
    function focusLocation(place: MapLocation, duration: number) {
        const map = instance()?.map;
        if (!map) return;

        // preserve closer inspection while bringing distant results to neighbourhood scale
        map.easeTo({
            center: [place.longitude, place.latitude],
            zoom: Math.max(map.getZoom(), 14),
            offset: container.clientWidth <= 800 ? [0, -container.clientHeight * 0.3] : [180, 0],
            duration,
        });
    }

    /** Keep selection shared between the markers and the directory. */
    function select(places: MapLocation[]) {
        closePreview();
        setGroupSearch("");
        setPanelOpen(true);
        setSelectedOrganisation(
            places.length === 1 && places[0].organisations.length === 1
                ? places[0].organisations[0].id
                : undefined,
        );
        setSelected(places.map((place) => place.id));
        const first = places[0];
        if (first) focusLocation(first, 400);
        queueMicrotask(() => backButton?.focus({ preventScroll: true }));
    }

    /** Fit the full city extent on every screen size and restore it on reset. */
    function frame() {
        setSelected([]);
        const camera = overview(
            Boolean(props.isHero),
            container.clientWidth,
            container.clientHeight,
            isPanelOpen(),
        );
        instance()?.map.fitBounds(camera.bounds, camera.fitBoundsOptions);
    }

    // Load WebGL only in the browser and dispose it when navigating away.
    onMount(() => {
        let map: GeographicMap | undefined;
        // dismiss mouse previews even when keyboard focus is outside the map
        const dismissPreview = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || !previewKey) return;
            event.stopPropagation();
            if (preview?.getElement().contains(document.activeElement)) {
                map?.getCanvas().focus({ preventScroll: true });
            }
            closePreview();
        };
        window.addEventListener("keydown", dismissPreview, true);
        // capture movement before markers can replace a preview along the approach
        const trackPointer = (event: PointerEvent) => {
            if (event.pointerType !== "mouse") return;
            pointer = { x: event.clientX, y: event.clientY };
            if (!preview) return;
            if (isApproachingPreview()) keepPreview();
            else leavePreview();
        };
        window.addEventListener("pointermove", trackPointer, true);
        // discard stale coordinates when the pointer leaves the browser window
        const leaveWindow = (event: PointerEvent) => {
            if (event.relatedTarget !== null) return;
            pointer = undefined;
            leavePreview();
        };
        window.addEventListener("pointerout", leaveWindow);
        window.addEventListener("blur", closePreview);
        let previousWidth = container.clientWidth;
        let previousHeight = container.clientHeight;
        const observer = new ResizeObserver(() => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (width === previousWidth && height === previousHeight) return;
            previousWidth = width;
            previousHeight = height;

            closePreview();
            map?.resize();
            if (props.isHero) frame();
            else if (selectedPlaces()[0]) focusLocation(selectedPlaces()[0], 0);
            setView((value) => value + 1);
        });
        observer.observe(container);
        onCleanup(() => {
            isDisposed = true;
            window.removeEventListener("keydown", dismissPreview, true);
            window.removeEventListener("pointermove", trackPointer, true);
            window.removeEventListener("pointerout", leaveWindow);
            window.removeEventListener("blur", closePreview);
            closePreview();
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
                    style: mapStyle(Boolean(props.isHero)),
                    ...overview(
                        Boolean(props.isHero),
                        container.clientWidth,
                        container.clientHeight,
                        isPanelOpen(),
                    ),
                    trackResize: false,
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
                map.on("movestart", closePreview);
                map.on("zoom", () => setZoom(map!.getZoom()));
                map.on("error", () => setError(true));
                map.on("idle", () => {
                    if (map!.areTilesLoaded()) setError(false);
                });
                map.on("load", () => {
                    addOrganisationLayers(map!, !props.isHero);
                    setInstance({ map: map!, Marker: library.Marker, Popup: library.Popup });
                    setZoom(map!.getZoom());
                });
                if (!props.isHero) {
                    map.on("click", ["organisations", "organisation-dots"], (event) => {
                        const feature = event.features?.[0];
                        const place = markers().find(
                            (entry) => entry.id === feature?.properties.place,
                        );
                        if (place) select([place]);
                    });
                    map.on("mousemove", ["organisations", "organisation-dots"], (event) => {
                        if (!window.matchMedia("(any-hover: hover)").matches || map!.isMoving())
                            return;
                        map!.getCanvas().style.cursor = "pointer";
                        const feature = event.features?.[0];
                        const place = markers().find(
                            (entry) => entry.id === feature?.properties.place,
                        );
                        if (place) {
                            showPreview([place], [event.point.x, event.point.y]);
                        }
                    });
                    map.on("mouseleave", ["organisations", "organisation-dots"], () => {
                        map!.getCanvas().style.cursor = "";
                        leavePreview();
                    });
                }
            })
            .catch(() => {
                if (!isDisposed) setError(true);
            });
    });

    // Place host and sponsor logos, moving them apart where they would overlap.
    createEffect(() => {
        const current = instance();
        const entries = markers();
        view();
        if (!current) return;

        // shared addresses always stay at their real position, independent of group size
        const groups = entries
            .filter((place) => place.organisations.length > 1)
            .map((place) => ({
                id: place.id,
                ...current.map.project([place.longitude, place.latitude]),
                place,
                person: place.organisations[0],
                size: 24,
                offset: [0, 0] as [number, number],
            }))
            .filter(
                (marker) =>
                    marker.x >= 0 &&
                    marker.y >= 0 &&
                    marker.x <= container.clientWidth &&
                    marker.y <= container.clientHeight,
            );

        const logos = arrangeLogos(
            entries
                .filter((place) => place.organisations.length === 1)
                .flatMap((place) => {
                    const point = current.map.project([place.longitude, place.latitude]);
                    return place.organisations.filter(isHighlighted).map((person) => ({
                        id: `${place.id}:${person.id}`,
                        ...point,
                        size: { large: 36, medium: 30, small: 26 }[person.prominence],
                        place,
                        person,
                    }));
                }),
            { width: container.clientWidth, height: container.clientHeight },
            groups,
        );
        setCrowded(new Set(logos.crowded.map((logo) => logo.id)));
        const placedMarkers = [...logos.placed, ...groups].map(
            ({ place: anchor, person: first, size, offset }) => {
                const places = [anchor];
                const isGroup = anchor.organisations.length > 1;
                const name = isGroup ? placeName(anchor) : first.name;
                const element = document.createElement("div");
                const dispose = render(
                    () => (
                        <Dynamic
                            component={props.isHero ? "a" : "button"}
                            href={props.isHero ? "/map" : undefined}
                            type={props.isHero ? undefined : "button"}
                            class="map-pin"
                            classList={{
                                "map-pin--group": isGroup,
                                "map-pin--hero": props.isHero,
                                "map-pin--sponsor": anchor.organisations.some(
                                    (person) => person.isSponsor,
                                ),
                                "map-pin--hovered": anchor.organisations.some((person) =>
                                    hovered().includes(person.id),
                                ),
                                "map-pin--selected": places.some(
                                    (place) =>
                                        selected().includes(place.id) &&
                                        (!selectedOrganisation() ||
                                            anchor.organisations.some(
                                                (person) => person.id === selectedOrganisation(),
                                            )),
                                ),
                            }}
                            style={{
                                "--map-logo-size": `${size - 4}px`,
                            }}
                            aria-label={`${name}, ${anchor.address}${isGroup ? `, ${anchor.organisations.length} organisations` : ""}`}
                            title={props.isHero ? name : undefined}
                            aria-pressed={
                                props.isHero
                                    ? undefined
                                    : places.some((place) => selected().includes(place.id)) &&
                                      (!selectedOrganisation() ||
                                          anchor.organisations.some(
                                              (person) => person.id === selectedOrganisation(),
                                          ))
                            }
                            onPointerEnter={(
                                event: PointerEvent & { currentTarget: HTMLElement },
                            ) => {
                                if (props.isHero) setHovered([first.id]);
                                else if (event.pointerType === "mouse")
                                    previewLogo(places, event.currentTarget);
                            }}
                            onPointerLeave={leavePreview}
                            onFocus={(event: FocusEvent & { currentTarget: HTMLElement }) => {
                                if (props.isHero) setHovered([first.id]);
                                else if (event.currentTarget.matches(":focus-visible"))
                                    previewLogo(places, event.currentTarget, true);
                            }}
                            onBlur={leavePreview}
                            onClick={() => {
                                if (!props.isHero) select(places);
                            }}
                        >
                            <span class="map-pin__logos">
                                <span class="map-logo">
                                    <Show
                                        when={isGroup}
                                        fallback={
                                            <Show
                                                when={first.mapLogoUrl ?? first.logoUrl}
                                                fallback={first.name.slice(0, 1)}
                                            >
                                                {(source) => (
                                                    <img
                                                        crossorigin={
                                                            first.isSponsor
                                                                ? undefined
                                                                : "anonymous"
                                                        }
                                                        src={source()}
                                                        alt=""
                                                        onLoad={(event) => {
                                                            if (!first.isSponsor) {
                                                                const image = event.currentTarget;
                                                                image
                                                                    .closest<HTMLElement>(
                                                                        ".map-pin",
                                                                    )!
                                                                    .style.setProperty(
                                                                        "--map-logo-background",
                                                                        logoBackground(image),
                                                                    );
                                                            }
                                                        }}
                                                    />
                                                )}
                                            </Show>
                                        }
                                    >
                                        <span class="map-pin__dot" aria-hidden="true" />
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
            },
        );
        onCleanup(() =>
            placedMarkers.forEach(({ marker, dispose }) => {
                marker.remove();
                dispose();
            }),
        );
    });

    // draw standalone badges and reserve label space for logos and shared addresses
    createEffect(() => {
        const current = instance();
        const places = markers();
        if (!current) return;

        // show the marker layer now and ignore logo updates after this view is disposed
        let isStale = false;
        onCleanup(() => (isStale = true));
        const badges = props.isHero
            ? Promise.resolve()
            : addBadges(
                  current.map,
                  places.filter((place) => place.organisations.length === 1),
                  () => !isDisposed,
              );
        const crowdedIds = crowded();
        showOrganisations(
            current.map,
            places,
            (organisation, place) =>
                isHighlighted(organisation) && !crowdedIds.has(`${place.id}:${organisation.id}`),
        );
        void badges.catch((error) => {
            console.error("Map badges failed to load", error);
            if (!isStale) setError(true);
        });
    });

    // Mark hovered and selected organisations above the rest.
    createEffect(() => {
        const current = instance();
        const ids = [
            ...hovered(),
            ...selectedPlaces().flatMap((place) => place.organisations.map((person) => person.id)),
        ];
        if (current) highlightOrganisations(current.map, markers(), ids);
    });

    return (
        <div
            classList={{ "map-explorer": !props.isHero }}
            onKeyDown={(event) => {
                if (event.key === "Escape" && selected().length) {
                    event.stopPropagation();
                    closeDetails();
                } else if (event.key === "Escape" && isPanelOpen()) {
                    event.stopPropagation();
                    setPanelOpen(false);
                    setHovered([]);
                    instance()?.map.getCanvas().focus({ preventScroll: true });
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
                                <ZoomIn aria-hidden="true" />
                            </button>
                            <button
                                class="map-control"
                                type="button"
                                onClick={() => instance()?.map.zoomOut()}
                                disabled={!instance() || zoom() <= 3}
                                aria-label="Zoom out"
                                title="Zoom out"
                            >
                                <ZoomOut aria-hidden="true" />
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
                                <LocateFixed aria-hidden="true" />
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
                <Show when={!props.isHero}>
                    <aside class="map-directory-panel" aria-label="Map explorer">
                        <header class="map-directory-heading">
                            <h1>Explore Zurich</h1>
                            <a
                                class="map-panel-action"
                                href="/manage"
                                aria-label="Add your organisation"
                                title="Add your organisation"
                            >
                                <Plus size={18} />
                            </a>
                            <button
                                class="map-panel-action"
                                type="button"
                                aria-label={
                                    isPanelOpen() ? "Collapse results" : "Browse organisations"
                                }
                                title={isPanelOpen() ? "Collapse results" : "Browse organisations"}
                                aria-expanded={isPanelOpen()}
                                aria-controls="map-results-panel"
                                onClick={() => {
                                    setPanelOpen(!isPanelOpen());
                                    setSelected([]);
                                    setHovered([]);
                                }}
                            >
                                {isPanelOpen() ? <X size={18} /> : <List size={18} />}
                            </button>
                        </header>
                        <label class="map-search">
                            <Search size={18} aria-hidden="true" />
                            <input
                                class="field__control"
                                type="search"
                                aria-label="Search organisations or addresses"
                                value={search()}
                                placeholder="Search organisations or addresses"
                                onInput={(event) => {
                                    setSearch(event.currentTarget.value);
                                    setSelected([]);
                                    setPanelOpen(true);
                                }}
                            />
                        </label>
                        <div class="map-filters">
                            <div class="map-type">
                                <select
                                    aria-label="Organisation type"
                                    value={category()}
                                    onChange={(event) => {
                                        setCategory(event.currentTarget.value);
                                        setSelected([]);
                                        setHovered([]);
                                        setPanelOpen(true);
                                    }}
                                >
                                    <option value="all">All types</option>
                                    <For each={Object.entries(organisationKinds)}>
                                        {([value, label]) => <option value={value}>{label}</option>}
                                    </For>
                                </select>
                                <ChevronDown size={16} aria-hidden="true" />
                            </div>
                            <button
                                type="button"
                                class="map-browse"
                                onClick={() => {
                                    setSelected([]);
                                    setPanelOpen(true);
                                }}
                            >
                                <List size={14} /> {organisationCount()} organisation
                                {organisationCount() === 1 ? "" : "s"}
                            </button>
                        </div>
                        <Show when={isPanelOpen()}>
                            <div id="map-results-panel" class="map-panel-content">
                                <Show
                                    when={selectedPlaces().length}
                                    fallback={
                                        <>
                                            <p class="map-results" role="status">
                                                {organisations() === undefined
                                                    ? "Loading locations…"
                                                    : search() ||
                                                        category() !== "all" ||
                                                        visible().length === organisationCount()
                                                      ? `${organisationCount()} organisation${organisationCount() === 1 ? "" : "s"}`
                                                      : `${visible().length} of ${organisationCount()} organisations in view`}
                                            </p>
                                            <Show
                                                when={
                                                    organisations() !== undefined &&
                                                    !(
                                                        search() || category() !== "all"
                                                            ? listed()
                                                            : visible()
                                                    ).length
                                                }
                                            >
                                                <p class="map-empty">
                                                    {search() || category() !== "all"
                                                        ? "No locations match your search."
                                                        : "No organisations in this area."}
                                                </p>
                                            </Show>
                                            <For
                                                each={
                                                    search() || category() !== "all"
                                                        ? listed()
                                                        : visible()
                                                }
                                            >
                                                {(place) => (
                                                    <>
                                                        <button
                                                            class="map-location-row"
                                                            classList={{
                                                                "is-hovered":
                                                                    place.organisations.some(
                                                                        (person) =>
                                                                            hovered().includes(
                                                                                person.id,
                                                                            ),
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
                                                                        place.organisations[0]
                                                                            .mapLogoUrl ??
                                                                        place.organisations[0]
                                                                            .logoUrl
                                                                    }
                                                                    fallback={place.organisations[0].name.slice(
                                                                        0,
                                                                        1,
                                                                    )}
                                                                >
                                                                    {(source) => (
                                                                        <Image
                                                                            loading="lazy"
                                                                            src={source()}
                                                                            darkSrc={
                                                                                place
                                                                                    .organisations[0]
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
                                                                            .map(
                                                                                (person) =>
                                                                                    person.name,
                                                                            )
                                                                            .join(" · ")}
                                                                        terms={terms()}
                                                                    />
                                                                </strong>
                                                                <small>
                                                                    <Show
                                                                        when={
                                                                            place.organisations[0]
                                                                                .recognition
                                                                        }
                                                                    >
                                                                        {(recognition) => (
                                                                            <span class="map-recognition">
                                                                                {recognition()}
                                                                            </span>
                                                                        )}
                                                                    </Show>
                                                                    {
                                                                        organisationKinds[
                                                                            place.organisations[0]
                                                                                .kind
                                                                        ]
                                                                    }
                                                                    {" · "}
                                                                    {place.address
                                                                        .split(", ")
                                                                        .at(-1)}
                                                                </small>
                                                            </span>
                                                        </button>
                                                    </>
                                                )}
                                            </For>
                                        </>
                                    }
                                >
                                    <div class="map-details">
                                        <button
                                            class="map-back"
                                            type="button"
                                            ref={backButton}
                                            onClick={() => {
                                                closeDetails();
                                            }}
                                        >
                                            <ArrowLeft size={16} /> Results
                                        </button>
                                        <Show when={!selectedOrganisation()}>
                                            <h2 class="map-place__name">
                                                {placeName(selectedPlaces()[0])}
                                            </h2>
                                            <label class="map-search">
                                                <Search size={18} aria-hidden="true" />
                                                <input
                                                    class="field__control"
                                                    type="search"
                                                    aria-label="Search this address"
                                                    placeholder="Search this address"
                                                    value={groupSearch()}
                                                    onInput={(event) =>
                                                        setGroupSearch(event.currentTarget.value)
                                                    }
                                                />
                                            </label>
                                            <p class="map-results" role="status">
                                                {filterLocations(
                                                    selectedPlaces(),
                                                    "all",
                                                    groupTerms(),
                                                ).reduce(
                                                    (count, place) =>
                                                        count + place.organisations.length,
                                                    0,
                                                )}{" "}
                                                of{" "}
                                                {selectedPlaces().reduce(
                                                    (count, place) =>
                                                        count + place.organisations.length,
                                                    0,
                                                )}{" "}
                                                organisations
                                            </p>
                                        </Show>
                                        <PlaceDetails
                                            places={filterLocations(
                                                selectedPlaces(),
                                                "all",
                                                groupTerms(),
                                            )}
                                        />
                                    </div>
                                </Show>
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
                            <div class="map-person">
                                <a
                                    class="map-person__link"
                                    href={
                                        organisation.website ||
                                        `/organisations/${organisation.slug}`
                                    }
                                    target={organisation.website ? "_blank" : undefined}
                                    rel={organisation.website ? "noopener noreferrer" : undefined}
                                    title={
                                        organisation.website
                                            ? "Visit website (opens in a new tab)"
                                            : "View organisation"
                                    }
                                >
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
                                    <Dynamic
                                        component={organisation.website ? ArrowUpRight : ArrowRight}
                                        size={16}
                                        aria-hidden="true"
                                    />
                                </a>
                                <Show when={organisation.socials}>
                                    {(socials) => (
                                        <SocialLinks
                                            name={organisation.name}
                                            profiles={socials()}
                                        />
                                    )}
                                </Show>
                            </div>
                        )}
                    </For>
                </section>
            )}
        </For>
    );
}
