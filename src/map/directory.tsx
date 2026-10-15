import { createVirtualizer, defaultRangeExtractor, type Range } from "@tanstack/solid-virtual";
import {
    createEffect,
    createMemo,
    createSignal,
    For,
    onCleanup,
    onMount,
    type JSX,
} from "solid-js";
import type { MapLocation } from "./queries";
import "./directory.css";

/** Restore a directory result after returning from details. */
export type MapDirectoryHandle = {
    /** Schedule focus after measurement; return false for absent results or disposed instances. */
    focus: (placeId: string, orgId?: string) => boolean;
};

/** Virtualize variable-height results while retaining sequential keyboard navigation. */
export function MapDirectory(props: {
    /** Complete matching results, including flattened tenants at shared addresses. */
    places: MapLocation[];
    /** Render the original result controls without adding a second tab stop. */
    children: (place: MapLocation) => JSX.Element;
    /** Default to the surrounding map panel's scroll container after mounting. */
    scrollElement?: HTMLElement;
    /** Receive a focus API that remains safe to call after this instance unmounts. */
    onReady?: (handle: MapDirectoryHandle) => void;
}) {
    let root!: HTMLDivElement;
    let disposed = false;
    let frame: number | undefined;
    let pending: { key: string; orgId?: string; last: boolean } | undefined;
    const rows = new Map<string, HTMLDivElement>();
    const [scrollElement, setScrollElement] = createSignal<HTMLElement>();
    const [margin, setMargin] = createSignal(0);
    const [focused, setFocused] = createSignal<string>();
    const records = createMemo(
        () => new Map(props.places.map((place) => [directoryKey(place), place])),
    );
    const keys = createMemo(() => [...records().keys()]);
    const indices = createMemo(() => new Map(keys().map((key, index) => [key, index])));
    // invalidate TanStack's measurement memo even when replacements preserve the row count
    const itemKey = createMemo(() => {
        const snapshot = keys();

        return (index: number) => snapshot[index];
    });

    // retain endpoints for entering from either direction, plus the currently focused row
    const virtualizer = createVirtualizer<HTMLElement, HTMLDivElement>({
        get count() {
            return props.places.length;
        },
        getScrollElement: () => props.scrollElement ?? scrollElement() ?? null,
        estimateSize: () => 100,
        get getItemKey() {
            return itemKey();
        },
        overscan: 8,
        useAnimationFrameWithResizeObserver: true,
        get scrollMargin() {
            return margin();
        },
        get rangeExtractor() {
            const active = focused() === undefined ? undefined : indices().get(focused()!);
            return (range: Range) =>
                [
                    ...new Set([
                        ...defaultRangeExtractor(range),
                        ...(range.count ? [0, range.count - 1] : []),
                        ...(active === undefined ? [] : [active]),
                    ]),
                ].sort((left, right) => left - right);
        },
    });
    const items = createMemo(
        () => new Map(virtualizer.getVirtualItems().map((item) => [String(item.key), item])),
    );
    // join cached geometry to current records before creating row lifetimes
    const rendered = createMemo(() => {
        const current = records();
        const rows: MapLocation[] = [];
        for (const key of items().keys()) {
            const place = current.get(key);
            if (place !== undefined) rows.push(place);
        }

        return rows;
    });

    /** Measure the list offset independently of scrolling and preceding status text. */
    function measureMargin() {
        const scroll = props.scrollElement ?? scrollElement();
        if (!scroll || !root.isConnected) return;
        setMargin(
            root.getBoundingClientRect().top -
                scroll.getBoundingClientRect().top -
                scroll.clientTop +
                scroll.scrollTop,
        );
    }

    /** Finish focus only after the target row exists and its actual height is measured. */
    function finishFocus() {
        frame = undefined;
        if (disposed || !pending) return;
        const row = rows.get(pending.key);
        const index = indices().get(pending.key);
        if (!row || index === undefined) return;

        // preserve a specific tenant when a row contains multiple organisation controls
        virtualizer.measureElement(row);
        virtualizer.scrollToIndex(index, { align: "auto" });
        const controls = focusable(row);
        const target =
            controls.find(
                (element) =>
                    pending!.orgId !== undefined &&
                    element.dataset.organisationId === pending!.orgId,
            ) ??
            (pending.last ? controls.at(-1) : controls[0]) ??
            row;
        pending = undefined;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    /** Pin a target before scrolling so focus never depends on the current rendered range. */
    function focusIndex(index: number, last = false, orgId?: string) {
        if (disposed || index < 0 || index >= props.places.length) return false;
        pending = { key: keys()[index], orgId, last };
        setFocused(pending.key);
        measureMargin();
        virtualizer.scrollToIndex(index, { align: "auto" });
        if (frame !== undefined) cancelAnimationFrame(frame);
        frame = requestAnimationFrame(finishFocus);

        return true;
    }

    /** Cross row boundaries without trapping native Tab navigation within a row or list. */
    function navigate(event: KeyboardEvent) {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const row = target.closest<HTMLDivElement>("[data-directory-key]");
        const index = row ? indices().get(row.dataset.directoryKey!) : undefined;
        if (!row || index === undefined) return;

        // text editing and other embedded widgets retain their own arrow handling
        const controls = focusable(row);
        let direction: number;
        if (event.key === "Tab") {
            if (target !== (event.shiftKey ? controls[0] : controls.at(-1)) && target !== row)
                return;
            direction = event.shiftKey ? -1 : 1;
        } else if (
            (event.key === "ArrowDown" || event.key === "ArrowUp") &&
            !target.closest("input,textarea,select,[contenteditable],[role=slider],[role=combobox]")
        ) {
            direction = event.key === "ArrowDown" ? 1 : -1;
        } else return;

        // allow the browser to leave the directory at its real first and last results
        if (index + direction < 0 || index + direction >= props.places.length) return;
        event.preventDefault();
        focusIndex(index + direction, direction < 0);
    }

    // resolve the scroll container only on the client and observe layout changes above the list
    onMount(() => {
        const scroll = props.scrollElement ?? root.closest<HTMLElement>(".map-panel-content");
        if (!scroll)
            throw new Error(
                "MapDirectory requires a scrollElement or .map-panel-content ancestor.",
            );
        setScrollElement(scroll);
        // defer layout writes until after observer delivery, coalescing repeated notifications
        let layoutFrame: number | undefined;
        const observer = new ResizeObserver(() => {
            if (layoutFrame !== undefined) return;
            layoutFrame = requestAnimationFrame(() => {
                layoutFrame = undefined;
                measureMargin();
            });
        });
        observer.observe(scroll);
        observer.observe(root);
        for (const sibling of Array.from(root.parentElement?.children ?? [])) {
            if (sibling !== root) observer.observe(sibling);
        }
        measureMargin();
        props.onReady?.({
            focus: (placeId, orgId) =>
                focusIndex(
                    props.places.findIndex(
                        (place) =>
                            place.id === placeId &&
                            (orgId === undefined ||
                                place.organisations.some((entry) => entry.id === orgId)),
                    ),
                    false,
                    orgId,
                ),
        });
        onCleanup(() => {
            observer.disconnect();
            if (layoutFrame !== undefined) cancelAnimationFrame(layoutFrame);
        });
    });
    createEffect(() => {
        props.places;
        queueMicrotask(() => {
            if (!disposed && root) measureMargin();
        });
    });
    onCleanup(() => {
        disposed = true;
        if (frame !== undefined) cancelAnimationFrame(frame);
    });

    return (
        <div
            ref={root}
            class="map-virtual-directory"
            role="list"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
            onKeyDown={navigate}
        >
            <For each={rendered()}>
                {(place) => {
                    const key = directoryKey(place);
                    let row!: HTMLDivElement;
                    const index = () => indices().get(key);
                    const position = () => {
                        const current = index();

                        return current === undefined ? undefined : current + 1;
                    };
                    onMount(() => {
                        rows.set(key, row);
                        virtualizer.measureElement(row);
                    });
                    onCleanup(() => rows.delete(key));

                    return (
                        <div
                            ref={row}
                            class="map-virtual-directory-row"
                            role="listitem"
                            tabindex={-1}
                            data-directory-key={key}
                            data-index={index()}
                            aria-posinset={position()}
                            aria-setsize={props.places.length}
                            style={{
                                transform: `translateY(${(items().get(key)?.start ?? 0) - margin()}px)`,
                            }}
                            onFocusIn={() => setFocused(key)}
                        >
                            {props.children(place)}
                        </div>
                    );
                }}
            </For>
        </div>
    );
}

/** Identify a location and its exact displayed tenants independently of its result index. */
function directoryKey(place: MapLocation): string {
    return JSON.stringify([place.id, place.organisations.map((entry) => entry.id)]);
}

/** Read visible enabled tab stops without constructing selectors from organisation identifiers. */
function focusable(row: HTMLElement): HTMLElement[] {
    return Array.from(
        row.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea,[tabindex]"),
    ).filter(
        (element) =>
            element.tabIndex >= 0 &&
            !element.matches(":disabled,[hidden]") &&
            !element.closest("[inert]") &&
            element.getClientRects().length > 0,
    );
}
