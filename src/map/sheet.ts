/** Record the geometry and state at the start of a sheet gesture. */
export interface SheetDrag {
    /** Starting pointer coordinate. */
    y: number;
    /** Rendered starting height. */
    height: number;
    /** Collapsed, compact and expanded stops. */
    heights: number[];
    /** Whether results were open before dragging. */
    isOpen: boolean;
    /** Whether results were expanded before dragging. */
    isExpanded: boolean;
}

/** Resolve a released gesture, preserving its original state on cancellation. */
export function sheetDestination(drag: SheetDrag, y: number, cancelled: boolean) {
    if (cancelled) return { isOpen: drag.isOpen, isExpanded: drag.isExpanded };

    const origin = drag.isOpen ? (drag.isExpanded ? 2 : 1) : 0;
    const position = sheetPosition(drag.heights, drag.height, y - drag.y, origin);

    return { isOpen: position > 0, isExpanded: position === 2 };
}

/** Step through sheet sizes with arrow keys, or jump to an endpoint with Home and End. */
export function sheetKey(key: string, isOpen: boolean, isExpanded: boolean) {
    const origin = isOpen ? (isExpanded ? 2 : 1) : 0;
    let position: number;
    if (key === "ArrowUp") position = Math.min(2, origin + 1);
    else if (key === "ArrowDown") position = Math.max(0, origin - 1);
    else if (key === "Home") position = 0;
    else if (key === "End") position = 2;
    else return undefined;

    return { isOpen: position > 0, isExpanded: position === 2 };
}

/** Derive stops from measured controls and optional compact content, even while collapsed. */
export function sheetHeights(viewport: number, controls: number, content?: number): number[] {
    const expanded = Math.max(0, viewport - 12);
    const collapsed = Math.min(controls, expanded);

    return [
        collapsed,
        Math.max(
            collapsed,
            Math.min(
                content === undefined ? viewport * 0.6 : controls + content,
                viewport * 0.6,
                expanded,
            ),
        ),
        expanded,
    ];
}

/** Snap to the nearest position, advancing one position for a deliberate short drag. */
export function sheetPosition(
    heights: number[],
    start: number,
    distance: number,
    initial?: number,
): number {
    const target = start - distance;
    const origin =
        initial ??
        heights.reduce(
            (best, height, index) =>
                Math.abs(height - start) < Math.abs(heights[best] - start) ? index : best,
            0,
        );

    // prefer the actual state when short viewport stops occupy the same height
    const nearest = heights.reduce(
        (best, height, index) =>
            Math.abs(height - target) < Math.abs(heights[best] - target) ? index : best,
        origin,
    );

    return nearest === origin && Math.abs(distance) > 40
        ? Math.max(0, Math.min(2, origin + (distance < 0 ? 1 : -1)))
        : nearest;
}
