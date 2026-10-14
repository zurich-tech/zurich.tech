/** Keep each sheet position within the available viewport. */
export function sheetHeights(viewport: number, controls: number): number[] {
    const expanded = Math.max(0, viewport - 12);
    const collapsed = Math.min(controls, expanded);

    return [collapsed, Math.max(collapsed, viewport * 0.6), expanded];
}

/** Snap to the nearest position, advancing one position for a deliberate short drag. */
export function sheetPosition(heights: number[], start: number, distance: number): number {
    const target = start - distance;
    const nearest = heights.reduce(
        (best, height, index) =>
            Math.abs(height - target) < Math.abs(heights[best] - target) ? index : best,
        0,
    );
    const origin = heights.reduce(
        (best, height, index) =>
            Math.abs(height - start) < Math.abs(heights[best] - start) ? index : best,
        0,
    );

    return nearest === origin && Math.abs(distance) > 40
        ? Math.max(0, Math.min(2, origin + (distance < 0 ? 1 : -1)))
        : nearest;
}
