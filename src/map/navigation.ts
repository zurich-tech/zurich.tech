import type { PaddingOptions } from "maplibre-gl";

/** Identify the addresses and optional organisation shown in the sheet. */
export interface MapSelection {
    /** Selected address identifiers. */
    places: string[];
    /** Selected organisation, or undefined for a complete address group. */
    organisation?: string;
}

/** Preserve the view from which a result or group member was opened. */
export interface MapView {
    /** Result button to refocus when returning from directory details. */
    result?: MapSelection;
    /** Geographic camera before opening details. */
    camera: {
        center: [number, number];
        zoom: number;
        bearing: number;
        pitch: number;
        padding: PaddingOptions;
    };
    /** Previous selection, empty for directory results. */
    selection: MapSelection;
    /** Search text within the selected address group. */
    groupSearch: string;
    /** Scroll offset within results or group details. */
    scrollTop: number;
    /** Whether the previous sheet was open. */
    isOpen: boolean;
    /** Whether the previous sheet was expanded. */
    isExpanded: boolean;
}

/** Retain return destinations while narrowing results into a group and its member. */
export class MapNavigation {
    /** View consumed by the next Back action. */
    private previous: MapView[] = [];

    /** Remember only directory selections and narrowing within the current group. */
    select(view: MapView, target: MapSelection, fromResults: boolean) {
        const isGroupMember =
            view.selection.places.length > 0 &&
            view.selection.organisation === undefined &&
            target.organisation !== undefined &&
            target.places.length === 1 &&
            view.selection.places.includes(target.places[0]);
        if (fromResults) this.previous = [view];
        else if (isGroupMember) this.previous.push(view);
        else this.reset();
    }

    /** Consume the saved destination so subsequent Back actions cannot reuse it. */
    back() {
        return this.previous.pop();
    }

    /** Discard a destination after the search, filters or browsing context changes. */
    reset() {
        this.previous = [];
    }
}

/** Restore a surviving result button, falling back to the map for marker selections. */
export function restoreMapFocus(
    result: MapSelection | undefined,
    buttons: Iterable<HTMLElement>,
    canvas: HTMLElement | undefined,
) {
    const button =
        result &&
        [...buttons].find(
            (element) =>
                element.dataset.placeId === result.places[0] &&
                element.dataset.organisationId === result.organisation,
        );
    (button || canvas)?.focus({ preventScroll: true });
}
