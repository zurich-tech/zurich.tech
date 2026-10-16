import {
    Search,
    ChevronDown,
    Plus,
    ArrowLeft,
    ArrowUpRight,
    ArrowRight,
    ZoomIn,
    ZoomOut,
    LocateFixed,
} from "lucide-solid";
import { organisationKinds } from "../../convex/organisations/kinds";
import { descendantTopics } from "../../convex/topics/hierarchy";
import { useSearchParams } from "@solidjs/router";
import { getTopics } from "../topics/queries";
import {
    createEffect,
    createMemo,
    createSignal,
    createSelector,
    onMount,
    onCleanup,
    Show,
    For,
} from "solid-js";
import { Dynamic, render } from "solid-js/web";
import type { Map as GeographicMap, Popup, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { getMap, type MapLocation } from "./queries";
import { publicClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import { MapActivity, type OrganisationActivity } from "./activity";
import { Image } from "../components/image";
import { SocialLinks } from "../components/social";
import { useSearch } from "../search/local";
import { searchTerms } from "../search/search";
import {
    countTopics,
    expandTopicFilters,
    filterLocations,
    nameTerms,
    topicFilters,
} from "./filter";
import { MapFilters } from "./filters";
import { MapDirectory, type MapDirectoryHandle } from "./directory";
import {
    countOrganisations,
    mapCount,
    matchingPlaces,
    organisationCountLabel,
    placeName,
    selectPlaces,
} from "./places";
import { Highlight } from "../components/highlight";
import { overview } from "./camera";
import { sheetDestination, sheetHeights, sheetKey, type SheetDrag } from "./sheet";
import { MapNavigation, restoreMapFocus } from "./navigation";
import { isPreviewPath, pickOrganisation, type Point } from "./hover";
import {
    addBadges,
    addOrganisationLayers,
    resizeOrganisationLayers,
    filterOrganisations,
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
        Popup: typeof Popup;
    }>();
    const [zoom, setZoom] = createSignal(12);
    const [error, setError] = createSignal(false);
    const navigation = new MapNavigation();
    let directoryHandle: MapDirectoryHandle | undefined;
    const { query, setQuery } = useSearch();
    // retain equivalent searches so whitespace and case changes do not rebuild map results
    const terms = createMemo(() => searchTerms(query()), undefined, {
        equals: (previous, next) =>
            previous.length === next.length &&
            previous.every((term, index) => term === next[index]),
    });
    const search = query;

    /** Filter immediately and retain the query in the URL. */
    function searchMap(value: string) {
        resetNavigation();
        setQuery(value);
    }
    const [groupSearch, setGroupSearch] = createSignal("");
    const groupTerms = createMemo(() => searchTerms(groupSearch()));
    const [params, setParams] = useSearchParams();
    const category = () => (typeof params.kind === "string" ? params.kind : "all");
    const topic = createMemo(() =>
        topicFilters(typeof params.topic === "string" ? params.topic : undefined),
    );
    const topics = getTopics.use(() => (props.isHero ? undefined : []));
    const selectedTopics = createMemo(() => expandTopicFilters(topic(), topics()));
    const [isFilterOpen, setFilterOpen] = createSignal(false);
    const topicCounts = createMemo(() => {
        if (!isFilterOpen()) return {};
        const candidates = filterLocations(organisations() ?? [], category(), terms());

        return countTopics(candidates, topics() ?? []);
    });
    const isFiltered = () => Boolean(terms().length || category() !== "all" || topic().length);
    const [isPanelOpen, setPanelOpen] = createSignal(isFiltered());
    const [isExpanded, setExpanded] = createSignal(false);
    const [dragHeight, setDragHeight] = createSignal<number>();
    let panel!: HTMLElement;
    let handle!: HTMLButtonElement;
    let drag: SheetDrag | undefined;
    let didDrag = false;
    let suppressHandleClick = false;

    /** Prevent an obsolete gesture from settling a newly selected or filtered view. */
    function discardSheetDrag() {
        suppressHandleClick ||= didDrag;
        drag = undefined;
        didDrag = false;
        setDragHeight(undefined);
    }

    /** Discard return destinations and gestures when the browsing context changes. */
    function resetNavigation() {
        navigation.reset();
        discardSheetDrag();
    }

    /** Change sheet size without discarding its selection or return destination. */
    function showSheet(isOpen: boolean, isExpanded = false) {
        discardSheetDrag();
        setPanelOpen(isOpen);
        setExpanded(isExpanded);
        queueMicrotask(() => {
            const place = selectedPlaces()[0];
            if (place) focusLocation(place, 0);
        });
    }

    /** Begin a sheet gesture only when the mobile handle is visible. */
    function startSheet(y: number) {
        if (!handle?.offsetHeight) return;
        suppressHandleClick = false;
        const tools = panel.querySelector<HTMLElement>(".map-directory-tools")!;
        const content = panel.querySelector<HTMLElement>(".map-panel-content");
        const padding = parseFloat(getComputedStyle(panel).paddingBottom);
        const controls = tools.offsetHeight + padding;
        const viewport = panel.parentElement!.clientHeight;

        // compact content remains measurable when the results are collapsed
        const contentHeight = hasCompactContent() && content ? content.scrollHeight : undefined;
        drag = {
            y,
            height: panel.clientHeight,
            heights: sheetHeights(viewport, controls, contentHeight),
            isOpen: isPanelOpen(),
            isExpanded: isExpanded(),
        };
        didDrag = false;
    }

    /** Follow the pointer without changing the map camera on every movement. */
    function moveSheet(y: number) {
        if (!drag || Math.abs(y - drag.y) < 5) return;
        didDrag = true;
        setPanelOpen(true);
        setDragHeight(
            Math.max(drag.heights[0], Math.min(drag.heights[2], drag.height + drag.y - y)),
        );
    }

    /** Settle the sheet, then keep an active selection in the remaining map area. */
    function finishSheet(y: number, cancelled = false) {
        if (!drag) return;
        const shouldFocus = !cancelled && didDrag;
        // restore the exact starting state when the browser interrupts a gesture
        if (cancelled || didDrag) {
            const destination = sheetDestination(drag, y, cancelled);
            setPanelOpen(destination.isOpen);
            setExpanded(destination.isExpanded);
        }
        drag = undefined;
        didDrag = false;
        setDragHeight(undefined);
        if (shouldFocus)
            queueMicrotask(() => {
                const place = selectedPlaces()[0];
                if (place) focusLocation(place, 0);
            });
    }
    const [hovered, setHovered] = createSignal<string[]>([]);
    const isHovered = createSelector(hovered, (id: string, ids) => ids.includes(id));
    const [selected, setSelected] = createSignal<string[]>([]);
    const [selectedOrganisation, setSelectedOrganisation] = createSignal<string>();
    const [view, setView] = createSignal(0);
    const filtered = createMemo(() =>
        props.isHero
            ? (organisations() ?? [])
            : filterLocations(organisations() ?? [], category(), terms(), selectedTopics()),
    );
    const organisationCount = createMemo(() => countOrganisations(filtered()));
    const markers = createMemo(() => matchingPlaces(organisations() ?? [], filtered()));

    // list organisations alphabetically without separating supporters from other results
    const directory = createMemo(() =>
        (organisations() ?? [])
            .flatMap((place) =>
                place.organisations.map((person) => ({ ...place, organisations: [person] })),
            )
            .sort((left, right) =>
                left.organisations[0].name.localeCompare(right.organisations[0].name),
            ),
    );
    // retain row identity across searches so matching DOM nodes and images are reused
    const listed = createMemo(() => {
        const matches = new Map(
            filtered().map((place) => [
                place.id,
                new Set(place.organisations.map((entry) => entry.id)),
            ]),
        );

        return directory().filter((place) => matches.get(place.id)?.has(place.organisations[0].id));
    });

    // keep the list to what the map currently shows
    const visible = createMemo(() => {
        view();
        const bounds = instance()?.map.getBounds();
        return bounds
            ? listed().filter((place) => bounds.contains([place.longitude, place.latitude]))
            : listed();
    });
    const visibleCount = createMemo(() => countOrganisations(visible()));

    // narrow the selected places to the chosen organisation
    const selectedPlaces = createMemo(() =>
        selectPlaces(organisations() ?? [], selected(), selectedOrganisation()),
    );
    const hasCompactContent = () =>
        countOrganisations(selectedPlaces()) === 1 || (isFiltered() && listed().length <= 1);

    // invalidate return destinations for URL changes as well as explicit filter controls
    createEffect(() => {
        query();
        category();
        topic();
        navigation.reset();
        discardSheetDrag();
        setSelected([]);
        setSelectedOrganisation(undefined);
        setGroupSearch("");

        // start changed searches and filters at the first result
        const content = panel?.querySelector<HTMLElement>(".map-panel-content");
        if (content) content.scrollTop = 0;
    });
    let container!: HTMLDivElement;
    let isDisposed = false;
    let backButton: HTMLButtonElement | undefined;
    let preview: Popup | undefined;
    let disposePreview: (() => void) | undefined;
    let previewResize: ResizeObserver | undefined;
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
    let previewKey: string | undefined;
    let previewOrigin: Point | undefined;
    let previewSource: HTMLElement | undefined;
    let pointer: Point | undefined;
    let nextPreview: { key: string; timer: ReturnType<typeof setTimeout> } | undefined;

    /** Cancel a pending switch when the pointer leaves its target or enters the card. */
    function cancelPreviewSwitch() {
        clearTimeout(nextPreview?.timer);
        nextPreview = undefined;
    }

    /** Protect slow and diagonal movement from the marker to the card. */
    function isApproachingPreview() {
        const card = preview?.getElement().querySelector(".maplibregl-popup-content");

        return Boolean(
            previewSource?.matches(":hover") ||
            (card &&
                pointer &&
                previewOrigin &&
                isPreviewPath(pointer, previewOrigin, card.getBoundingClientRect())),
        );
    }

    /** Cancel a pending preview transition. */
    function keepPreview() {
        clearTimeout(previewTimer);
    }

    /** Remove the preview and its mounted content together. */
    function closePreview() {
        keepPreview();
        cancelPreviewSwitch();
        previewResize?.disconnect();
        previewResize = undefined;
        preview?.remove();
        disposePreview?.();
        preview = undefined;
        disposePreview = undefined;
        previewKey = undefined;
        previewOrigin = undefined;
        previewSource = undefined;
        setHovered([]);
    }

    /** Allow the pointer to cross the gap between a marker and its preview. */
    function leavePreview() {
        cancelPreviewSwitch();
        if (!preview) closePreview();
        else {
            keepPreview();
            previewTimer = setTimeout(() => {
                const element = preview?.getElement();
                if (
                    isApproachingPreview() ||
                    previewSource?.contains(document.activeElement) ||
                    element?.matches(":hover") ||
                    element?.contains(document.activeElement)
                )
                    return;
                closePreview();
            }, 250);
        }
    }

    /** Preview a marker without selecting it or moving keyboard focus. */
    function showPreview(
        places: MapLocation[],
        point: [number, number],
        isImmediate = false,
        sidebar?: HTMLElement,
    ) {
        const current = instance();
        if (props.isHero || isFilterOpen() || !current || current.map.isMoving()) return;
        const isSidebar = Boolean(sidebar);
        const key =
            (isSidebar ? "sidebar:" : "marker:") +
            places
                .map(
                    (place) =>
                        `${place.id}:${place.organisations.map((item) => item.id).join(",")}`,
                )
                .join(";");
        if (key === previewKey) {
            cancelPreviewSwitch();
            if (preview) keepPreview();
            return;
        }
        // protect crossing the gap, but let a deliberate hover choose a neighbouring marker
        if (!isImmediate && isApproachingPreview()) {
            if (nextPreview?.key !== key) {
                cancelPreviewSwitch();
                nextPreview = {
                    key,
                    timer: setTimeout(() => {
                        closePreview();
                        showPreview(places, point, true, sidebar);
                    }, 150),
                };
            }
            return;
        }
        closePreview();
        previewKey = key;
        previewSource = sidebar;
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
                            onPointerEnter={() => {
                                cancelPreviewSwitch();
                                keepPreview();
                            }}
                            onPointerLeave={leavePreview}
                            onFocusIn={() => {
                                cancelPreviewSwitch();
                                keepPreview();
                            }}
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
                                fallback={
                                    <PlaceDetails
                                        places={places}
                                        isCompact={isSidebar}
                                        topics={topics() ?? []}
                                        topicHref={topicHref}
                                        onTopic={filterTopic}
                                    />
                                }
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
                                        View all{" "}
                                        {organisationCountLabel(places[0].organisations.length)}{" "}
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
                    offset: isSidebar ? [-1, 0] : 18,
                    maxWidth: "min(320px, calc(100vw - 32px))",
                    className: isSidebar ? "map-preview map-preview--sidebar" : "map-preview",
                    anchor: isSidebar ? "top-left" : undefined,
                })
                    .setLngLat(position)
                    .setDOMContent(element)
                    .addTo(current.map);

                // align with the row unless the card needs to move up to stay on screen
                if (sidebar) {
                    preview
                        .getElement()
                        .style.setProperty(
                            "--map-preview-row-height",
                            `${sidebar.getBoundingClientRect().height}px`,
                        );
                    // keep asynchronously loaded news inside the map viewport
                    const alignPreview = () => {
                        if (!preview) return;
                        const height = preview.getElement().getBoundingClientRect().height;
                        const top = Math.max(12, Math.min(point[1], bounds.height - height - 12));
                        preview.setLngLat(current.map.unproject([point[0], top]));
                    };
                    previewResize = new ResizeObserver(alignPreview);
                    previewResize.observe(element);
                    alignPreview();
                }
            },
            isImmediate ? 0 : 180,
        );
    }

    /** Show a result beside the desktop directory without moving the map. */
    function previewResult(place: MapLocation, element: HTMLElement, isKeyboard = false) {
        setHovered(place.organisations.map((organisation) => organisation.id));
        if (!window.matchMedia("(min-width: 801px) and (any-hover: hover)").matches) return;

        // keep the card outside the panel and within the visible map height
        const panel = element.closest(".map-directory-panel")!.getBoundingClientRect();
        const row = element.getBoundingClientRect();
        const bounds = container.getBoundingClientRect();
        showPreview(
            [place],
            [panel.right - bounds.left, row.top - bounds.top],
            isKeyboard,
            element,
        );
    }

    // discard previews whose contents no longer match the active filters
    createEffect(() => {
        filtered();
        closePreview();
    });

    /** Restore the originating view and result focus, or canvas focus for map selections. */
    function closeDetails() {
        discardSheetDrag();
        const previous = navigation.back();
        const map = instance()?.map;
        setSelected(previous?.selection.places ?? []);
        setSelectedOrganisation(previous?.selection.organisation);
        setGroupSearch(previous?.groupSearch ?? "");
        setHovered([]);

        // restore camera synchronously so bounds dependent rows exist before restoring scroll
        if (previous) {
            setPanelOpen(previous.isOpen);
            setExpanded(previous.isExpanded);
            map?.jumpTo(previous.camera);
            setView((value) => value + 1);
            queueMicrotask(() => {
                const content = panel.querySelector<HTMLElement>(".map-panel-content");
                if (content) content.scrollTop = previous.scrollTop;
                // mount and measure directory targets before restoring keyboard focus
                const isDirectoryFocus =
                    previous.result &&
                    !previous.selection.places.length &&
                    directoryHandle?.focus(previous.result.places[0], previous.result.organisation);
                if (!isDirectoryFocus) {
                    restoreMapFocus(
                        previous.result,
                        panel.querySelectorAll<HTMLElement>("button[data-place-id]"),
                        map?.getCanvas(),
                    );
                }
            });
        } else map?.getCanvas().focus({ preventScroll: true });
    }

    /** Preserve existing map filters in shareable topic destinations. */
    function topicHref(slug: string) {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            for (const item of Array.isArray(value) ? value : [value]) {
                if (item !== undefined) query.append(key, item);
            }
        }
        query.set("topic", slug);

        return `/map?${query}`;
    }

    /** Apply a topic from details and return to the matching organisation list. */
    function filterTopic(slug: string) {
        resetNavigation();
        closePreview();
        setSelected([]);
        setSelectedOrganisation(undefined);
        setGroupSearch("");
        setHovered([]);
        setPanelOpen(true);
        setParams({ topic: slug }, { scroll: false });
        queueMicrotask(() =>
            panel
                .querySelector<HTMLInputElement>(".map-search input")
                ?.focus({ preventScroll: true }),
        );
    }

    /** Keep a chosen address visible beside the desktop panel or above the mobile sheet. */
    function focusLocation(place: MapLocation, duration: number) {
        const map = instance()?.map;
        if (!map) return;

        // centre selection in the space actually left beside or above the panel
        const panel = container
            .closest(".map-layout")
            ?.querySelector<HTMLElement>(".map-directory-panel");
        const isBottom = panel && panel.clientWidth >= container.clientWidth * 0.8;
        const offset: [number, number] = isBottom
            ? [0, -panel.clientHeight / 2]
            : [(panel?.clientWidth ?? 0) / 2, 0];

        // preserve closer inspection while bringing distant results to neighbourhood scale
        map.easeTo({
            center: [place.longitude, place.latitude],
            zoom: Math.max(map.getZoom(), 14),
            padding: { top: 0, right: 0, bottom: 0, left: 0 },
            offset,
            duration,
        });
    }

    /** Keep selection shared between the markers and the directory. */
    function select(places: MapLocation[], fromResults = false) {
        discardSheetDrag();
        const organisation =
            places.length === 1 && places[0].organisations.length === 1
                ? places[0].organisations[0].id
                : undefined;
        const ids = places.map((place) => place.id);
        const map = instance()?.map;

        // capture the list or group before changing its camera, contents or sheet height
        if (map) {
            navigation.select(
                {
                    result: fromResults ? { places: ids, organisation } : undefined,
                    camera: {
                        center: map.getCenter().toArray(),
                        zoom: map.getZoom(),
                        bearing: map.getBearing(),
                        pitch: map.getPitch(),
                        padding: { ...map.getPadding() },
                    },
                    selection: { places: selected(), organisation: selectedOrganisation() },
                    groupSearch: groupSearch(),
                    scrollTop:
                        panel.querySelector<HTMLElement>(".map-panel-content")?.scrollTop ?? 0,
                    isOpen: isPanelOpen(),
                    isExpanded: isExpanded(),
                },
                { places: ids, organisation },
                fromResults,
            );
        }

        closePreview();
        setGroupSearch("");
        setPanelOpen(true);
        setExpanded(false);
        panel?.querySelector<HTMLInputElement>(".map-search input")?.blur();
        setSelectedOrganisation(organisation);
        setSelected(ids);
        const first = places[0];
        queueMicrotask(() => {
            const content = panel.querySelector<HTMLElement>(".map-panel-content");
            if (content) content.scrollTop = 0;
            if (first) focusLocation(first, 400);
            backButton?.focus({ preventScroll: true });
        });
    }

    /** Fit the full city extent on every screen size and restore it on reset. */
    function frame() {
        resetNavigation();
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
        // fit the explorer above mobile keyboards without moving its controls off screen
        const viewport = window.visualViewport;
        const shell = container.closest<HTMLElement>(".site-shell");
        const resizeViewport = () => {
            if (!props.isHero && viewport)
                shell?.style.setProperty("--map-viewport-height", `${viewport.height}px`);
        };
        resizeViewport();
        viewport?.addEventListener("resize", resizeViewport);
        onCleanup(() => {
            viewport?.removeEventListener("resize", resizeViewport);
            if (!props.isHero) shell?.style.removeProperty("--map-viewport-height");
        });
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
            const isWidthChanged = width !== previousWidth;
            previousWidth = width;
            previousHeight = height;

            closePreview();
            map?.resize();
            if (instance() && isWidthChanged) resizeOrganisationLayers(map!, !props.isHero, width);
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
                    addOrganisationLayers(map!, !props.isHero, container.clientWidth);
                    setInstance({ map: map!, Popup: library.Popup });
                    setZoom(map!.getZoom());
                });
                if (!props.isHero) {
                    map.on("click", ["organisations", "organisation-dots"], (event) => {
                        const feature = pickOrganisation(event.features ?? [], map!.getZoom());
                        const place = markers().find(
                            (entry) => entry.id === feature?.properties.place,
                        );
                        if (place) select([place]);
                    });
                    map.on("mousemove", ["organisations", "organisation-dots"], (event) => {
                        if (!window.matchMedia("(any-hover: hover)").matches || map!.isMoving())
                            return;
                        const feature = pickOrganisation(event.features ?? [], map!.getZoom());
                        map!.getCanvas().style.cursor = feature ? "pointer" : "";
                        const place = markers().find(
                            (entry) => entry.id === feature?.properties.place,
                        );
                        if (place) {
                            showPreview([place], [event.point.x, event.point.y]);
                        } else leavePreview();
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

    // load badges once per catalogue update, independently of searches and camera movement
    createEffect(() => {
        const current = instance();
        const places = organisations();
        if (!current || !places) return;

        void addBadges(
            current.map,
            places.filter((place) => !props.isHero || place.organisations.some(isHighlighted)),
            () => !isDisposed,
        ).catch((error) => {
            console.error("Map badges failed to load", error);
            if (!isDisposed) setError(true);
        });
    });

    // retain geographic data while narrowing the visible layer with style filters
    createEffect(() => {
        const current = instance();
        const places = organisations() ?? [];
        if (!current) return;
        showOrganisations(current.map, places, isHighlighted);
    });
    createEffect(() => {
        const current = instance();
        if (current) filterOrganisations(current.map, markers());
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
                    discardSheetDrag();
                    setPanelOpen(false);
                    setExpanded(false);
                    setHovered([]);
                    instance()?.map.getCanvas().focus({ preventScroll: true });
                }
            }}
        >
            <div classList={{ "map-layout": !props.isHero }}>
                <div class="community-map" classList={{ "community-map--hero": props.isHero }}>
                    <div
                        ref={container}
                        class="map-canvas"
                        classList={{ "map-canvas--ready": Boolean(instance()) }}
                    />
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
                    <aside
                        ref={panel}
                        class="map-directory-panel"
                        classList={{
                            "is-open": isPanelOpen(),
                            "is-expanded": isExpanded(),
                            "is-dragging": dragHeight() !== undefined,
                            "has-selection": selectedPlaces().length > 0,
                            "has-single-organisation": countOrganisations(selectedPlaces()) === 1,
                            "has-no-results": isFiltered() && organisationCount() === 0,
                            "has-single-result": isFiltered() && listed().length === 1,
                        }}
                        style={{
                            "--sheet-height":
                                dragHeight() === undefined ? undefined : `${dragHeight()}px`,
                        }}
                        aria-label="Map explorer"
                    >
                        <div class="map-directory-tools">
                            <button
                                ref={handle}
                                class="map-sheet-handle"
                                type="button"
                                aria-label={
                                    isPanelOpen() ? "Close map results" : "Open map results"
                                }
                                title={`${isPanelOpen() ? "Close" : "Open"} map results; drag or use arrow keys to resize`}
                                aria-expanded={isPanelOpen()}
                                aria-controls="map-results-panel"
                                aria-keyshortcuts="ArrowUp ArrowDown Home End"
                                onKeyDown={(event) => {
                                    const destination = sheetKey(
                                        event.key,
                                        isPanelOpen(),
                                        isExpanded(),
                                    );
                                    if (!destination) return;
                                    event.preventDefault();
                                    event.stopPropagation();
                                    showSheet(destination.isOpen, destination.isExpanded);
                                }}
                                onPointerDown={(event) => {
                                    if (event.button !== 0) return;
                                    // prevent native link dragging beneath the moving sheet
                                    event.preventDefault();
                                    event.currentTarget.focus({ preventScroll: true });
                                    startSheet(event.clientY);
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                }}
                                onPointerMove={(event) => moveSheet(event.clientY)}
                                onPointerUp={(event) => {
                                    suppressHandleClick ||= didDrag;
                                    finishSheet(event.clientY);
                                }}
                                onPointerCancel={(event) => {
                                    suppressHandleClick = false;
                                    finishSheet(event.clientY, true);
                                }}
                                onClick={() => {
                                    if (suppressHandleClick) {
                                        suppressHandleClick = false;
                                        return;
                                    }
                                    showSheet(!isPanelOpen());
                                }}
                            >
                                <span aria-hidden="true" />
                            </button>
                            <header class="map-directory-heading">
                                <h1>Explore Zurich</h1>
                                <span
                                    class="map-count"
                                    title="Organisations in view / matching filters"
                                    aria-label={`${visibleCount()} organisations in view, ${organisationCount()} matching filters`}
                                >
                                    {organisations() === undefined
                                        ? "…"
                                        : mapCount(visibleCount(), organisationCount())}
                                </span>
                            </header>
                            <label class="map-search">
                                <Search size={18} aria-hidden="true" />
                                <input
                                    class="field__control"
                                    type="search"
                                    aria-label="Search organisations or addresses"
                                    value={search()}
                                    placeholder="Search organisations or addresses"
                                    onFocus={() => {
                                        if (handle?.offsetHeight) {
                                            setPanelOpen(true);
                                            setExpanded(true);
                                        }
                                    }}
                                    onInput={(event) => {
                                        searchMap(event.currentTarget.value);
                                        setSelected([]);
                                        setPanelOpen(true);
                                    }}
                                />
                            </label>
                            <div class="map-filters">
                                <MapFilters
                                    onOpenChange={(isOpen) => {
                                        setFilterOpen(isOpen);
                                        if (isOpen) closePreview();
                                    }}
                                    category={category()}
                                    topics={topic()}
                                    catalogue={topics() ?? []}
                                    counts={topicCounts()}
                                    onChange={(kind, selected) => {
                                        resetNavigation();
                                        setParams(
                                            {
                                                kind: kind === "all" ? undefined : kind,
                                                topic: selected.join(",") || undefined,
                                            },
                                            { replace: true, scroll: false },
                                        );
                                        setSelected([]);
                                        setHovered([]);
                                        closePreview();
                                        setPanelOpen(true);
                                    }}
                                />
                                <button
                                    class="map-panel-action map-toggle"
                                    type="button"
                                    aria-label={
                                        isPanelOpen() ? "Collapse results" : "Expand results"
                                    }
                                    title={isPanelOpen() ? "Collapse results" : "Expand results"}
                                    aria-expanded={isPanelOpen()}
                                    aria-controls="map-results-panel"
                                    onClick={() => showSheet(!isPanelOpen())}
                                >
                                    <ChevronDown size={18} />
                                </button>
                            </div>
                        </div>
                        <Show when={isPanelOpen() || hasCompactContent()}>
                            <div
                                id="map-results-panel"
                                class="map-panel-content"
                                aria-hidden={!isPanelOpen()}
                                inert={!isPanelOpen()}
                                onScroll={closePreview}
                                onTouchStart={(event) => {
                                    if (
                                        event.currentTarget.scrollTop <= 0 &&
                                        event.touches.length === 1
                                    )
                                        startSheet(event.touches[0].clientY);
                                }}
                                on:touchmove={(event) => {
                                    if (!drag) return;
                                    if (event.touches.length !== 1) {
                                        finishSheet(drag.y, true);
                                        return;
                                    }
                                    const y = event.touches[0].clientY;
                                    if (!didDrag && y <= drag.y) {
                                        drag = undefined;
                                        return;
                                    }
                                    if (event.cancelable) {
                                        event.preventDefault();
                                        moveSheet(y);
                                    }
                                }}
                                onTouchEnd={(event) => finishSheet(event.changedTouches[0].clientY)}
                                onTouchCancel={(event) =>
                                    finishSheet(event.changedTouches[0].clientY, true)
                                }
                            >
                                <Show
                                    when={selectedPlaces().length}
                                    fallback={
                                        <>
                                            <Show when={organisations() === undefined}>
                                                <p class="map-results" role="status">
                                                    Loading locations…
                                                </p>
                                            </Show>
                                            <Show
                                                when={
                                                    organisations() !== undefined &&
                                                    !(isFiltered() ? listed() : visible()).length
                                                }
                                            >
                                                <p class="map-empty">
                                                    {isFiltered()
                                                        ? "No locations match your search."
                                                        : "No organisations in this area."}
                                                </p>
                                            </Show>
                                            <MapDirectory
                                                places={isFiltered() ? listed() : visible()}
                                                onReady={(handle) => (directoryHandle = handle)}
                                            >
                                                {(place) => {
                                                    const person = place.organisations[0];
                                                    // keep unchanged names mounted when only an address or headline matches
                                                    const highlights = createMemo<
                                                        readonly string[]
                                                    >(
                                                        (previous) =>
                                                            nameTerms(
                                                                person.name,
                                                                terms(),
                                                                previous,
                                                            ),
                                                        [],
                                                    );

                                                    return (
                                                        <>
                                                            <button
                                                                class="map-location-row"
                                                                classList={{
                                                                    "is-hovered": isHovered(
                                                                        person.id,
                                                                    ),
                                                                }}
                                                                onPointerEnter={(event) =>
                                                                    previewResult(
                                                                        place,
                                                                        event.currentTarget,
                                                                    )
                                                                }
                                                                onPointerLeave={leavePreview}
                                                                onFocus={(event) =>
                                                                    previewResult(
                                                                        place,
                                                                        event.currentTarget,
                                                                        true,
                                                                    )
                                                                }
                                                                onBlur={leavePreview}
                                                                type="button"
                                                                data-place-id={place.id}
                                                                data-organisation-id={
                                                                    place.organisations[0].id
                                                                }
                                                                onClick={() =>
                                                                    select([place], true)
                                                                }
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
                                                                            terms={highlights()}
                                                                        />
                                                                    </strong>
                                                                    <small>
                                                                        <Show
                                                                            when={
                                                                                place
                                                                                    .organisations[0]
                                                                                    .recognition
                                                                            }
                                                                        >
                                                                            {(recognition) => (
                                                                                <span
                                                                                    class="map-recognition"
                                                                                    data-sponsor={
                                                                                        place
                                                                                            .organisations[0]
                                                                                            .isSponsor
                                                                                            ? recognition()
                                                                                            : undefined
                                                                                    }
                                                                                >
                                                                                    {recognition()}
                                                                                </span>
                                                                            )}
                                                                        </Show>
                                                                        {
                                                                            organisationKinds[
                                                                                place
                                                                                    .organisations[0]
                                                                                    .kind
                                                                            ]
                                                                        }
                                                                        {" · "}
                                                                        {place.address
                                                                            .split(", ")
                                                                            .at(-1)}
                                                                    </small>
                                                                    <Show
                                                                        when={
                                                                            place.organisations[0]
                                                                                .headline
                                                                        }
                                                                    >
                                                                        <span class="map-row-headline">
                                                                            {
                                                                                place
                                                                                    .organisations[0]
                                                                                    .headline
                                                                            }
                                                                        </span>
                                                                    </Show>
                                                                </span>
                                                            </button>
                                                        </>
                                                    );
                                                }}
                                            </MapDirectory>
                                            <footer class="map-results-footer">
                                                <a href="/manage">
                                                    <Plus size={16} />
                                                    Add organisation
                                                </a>
                                            </footer>
                                        </>
                                    }
                                >
                                    <div class="map-details">
                                        <div class="map-detail-navigation">
                                            <button
                                                class="map-back"
                                                type="button"
                                                ref={backButton}
                                                aria-label="Back to results"
                                                onClick={closeDetails}
                                            >
                                                <ArrowLeft size={16} />
                                                Results
                                            </button>
                                        </div>
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
                                                {countOrganisations(
                                                    filterLocations(
                                                        selectedPlaces(),
                                                        "all",
                                                        groupTerms(),
                                                    ),
                                                )}{" "}
                                                of{" "}
                                                {organisationCountLabel(
                                                    countOrganisations(selectedPlaces()),
                                                )}
                                            </p>
                                        </Show>
                                        <PlaceDetails
                                            activityPlaces={selectedPlaces()}
                                            topics={topics() ?? []}
                                            topicHref={topicHref}
                                            onTopic={filterTopic}
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
function PlaceDetails(detail: {
    places: MapLocation[];
    activityPlaces?: MapLocation[];
    isCompact?: boolean;
    topics: readonly { slug: string; name: string; parent?: string }[];
    topicHref: (slug: string) => string;
    onTopic: (slug: string) => void;
}) {
    const [activity, setActivity] = createSignal<OrganisationActivity[]>([]);
    const [activityError, setActivityError] = createSignal(false);
    const [attempt, setAttempt] = createSignal(0);
    const activitySlugs = createMemo(
        () =>
            [
                ...new Set(
                    (detail.activityPlaces ?? detail.places).flatMap((place) =>
                        place.organisations.map((organisation) => organisation.slug),
                    ),
                ),
            ].sort(),
        undefined,
        {
            equals: (left, right) =>
                left.length === right.length && left.every((slug, index) => slug === right[index]),
        },
    );

    // fetch only opened addresses, retaining the result when their local search changes
    createEffect(() => {
        const slugs = activitySlugs();
        attempt();
        let isActive = true;
        setActivity([]);
        setActivityError(false);
        void publicClient()
            .query(api.places.map.activity, { slugs })
            .then((result) => {
                if (isActive) setActivity(result);
            })
            .catch((error: unknown) => {
                console.error("Could not load map news and jobs.", error);
                if (isActive) setActivityError(true);
            });
        onCleanup(() => {
            isActive = false;
        });
    });

    /** Resolve unique labels and omit ancestors already represented by a specific subject. */
    function labels(values: readonly string[] = []) {
        const selected = detail.topics.filter((entry) => values.includes(entry.slug));

        return selected.filter((entry) => {
            const descendants = descendantTopics(entry.slug, detail.topics);

            return !selected.some(
                (other) => other.slug !== entry.slug && descendants.has(other.slug),
            );
        });
    }

    return (
        <>
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
                                        rel={
                                            organisation.website ? "noopener noreferrer" : undefined
                                        }
                                        title={
                                            organisation.website
                                                ? "Visit website (opens in a new tab)"
                                                : "View organisation"
                                        }
                                    >
                                        <Show when={!detail.isCompact}>
                                            <span class="map-person__logo">
                                                <Show
                                                    when={
                                                        organisation.mapLogoUrl ??
                                                        organisation.logoUrl
                                                    }
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
                                        </Show>
                                        <span class="map-person__copy">
                                            <strong>{organisation.name}</strong>
                                            <Show
                                                when={
                                                    organisation.location &&
                                                    organisation.location !== organisation.name
                                                }
                                            >
                                                <small>{organisation.location}</small>
                                            </Show>
                                            <Show
                                                when={
                                                    organisation.recognition &&
                                                    (organisation.isSponsor || !detail.isCompact)
                                                }
                                            >
                                                <small
                                                    class="map-recognition"
                                                    data-sponsor={
                                                        organisation.isSponsor
                                                            ? organisation.recognition
                                                            : undefined
                                                    }
                                                >
                                                    {organisation.recognition}
                                                </small>
                                            </Show>
                                            <Show when={!detail.isCompact}>
                                                <small>
                                                    {organisationKinds[organisation.kind]}
                                                </small>
                                                <Show when={organisation.headline}>
                                                    <span>{organisation.headline}</span>
                                                </Show>
                                            </Show>
                                        </span>
                                        <Dynamic
                                            component={
                                                organisation.website ? ArrowUpRight : ArrowRight
                                            }
                                            size={16}
                                            aria-hidden="true"
                                        />
                                    </a>
                                    <Show when={labels(organisation.topics).length}>
                                        <ul
                                            class="map-person__topics"
                                            aria-label={`${organisation.name} topics`}
                                        >
                                            <For each={labels(organisation.topics)}>
                                                {(entry) => (
                                                    <li>
                                                        <a
                                                            href={detail.topicHref(entry.slug)}
                                                            aria-label={`Filter organisations by ${entry.name}`}
                                                            onClick={(event) => {
                                                                if (
                                                                    event.button !== 0 ||
                                                                    event.metaKey ||
                                                                    event.ctrlKey ||
                                                                    event.shiftKey ||
                                                                    event.altKey
                                                                )
                                                                    return;
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                detail.onTopic(entry.slug);
                                                            }}
                                                        >
                                                            {entry.name}
                                                        </a>
                                                    </li>
                                                )}
                                            </For>
                                        </ul>
                                    </Show>
                                    <Show when={organisation.socials}>
                                        {(socials) => (
                                            <SocialLinks
                                                name={organisation.name}
                                                profiles={socials()}
                                            />
                                        )}
                                    </Show>
                                    <Show
                                        when={activity().find(
                                            (entry) => entry.slug === organisation.slug,
                                        )}
                                    >
                                        {(entry) => <MapActivity activity={entry()} />}
                                    </Show>
                                </div>
                            )}
                        </For>
                    </section>
                )}
            </For>
            <Show when={activityError()}>
                <p class="map-activity-error" role="status">
                    News and jobs couldn’t load.{" "}
                    <button type="button" onClick={() => setAttempt((value) => value + 1)}>
                        Retry
                    </button>
                </p>
            </Show>
        </>
    );
}
