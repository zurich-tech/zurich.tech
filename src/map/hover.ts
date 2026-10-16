/** A pointer position in viewport coordinates. */
export interface Point {
    x: number;
    y: number;
}

/** The marker fields that determine its drawing priority and visibility. */
type Marker = { isSponsor?: boolean; isLogo?: boolean; count?: number };

/** Reserve space for a shared preview without moving its controls when content changes. */
export function sharedPreview(point: Point, viewport: { width: number; height: number }) {
    const margin = 12;
    const gap = 18;
    const width = Math.min(320, viewport.width - margin * 2);
    const height = Math.min(560, viewport.height - margin * 2);
    const beside =
        point.x + gap + width <= viewport.width - margin ? point.x + gap : point.x - gap - width;

    return {
        left: Math.max(margin, Math.min(beside, viewport.width - width - margin)),
        top: Math.max(margin, Math.min(point.y - 80, viewport.height - height - margin)),
        width,
        height,
    };
}

/** Rank sponsors above hosts, shared addresses and ordinary markers. */
export function organisationOrder(marker: Marker) {
    return marker.isSponsor ? 3 : marker.isLogo ? 2 : (marker.count ?? 1) > 1 ? 1 : 0;
}

/** Match symbol drawing order instead of trusting MapLibre's source-ordered symbol hits. */
export function pickOrganisation<T extends { layer: { id: string }; properties: Marker }>(
    features: readonly T[],
    zoom: number,
): T | undefined {
    let selected: T | undefined;
    let priority = -1;

    // retain the renderer's topmost result for equal priorities, including tiled duplicates
    for (const feature of features) {
        const layer = feature.layer.id;
        const marker = feature.properties;
        const isBadge = layer === "organisations";
        if (layer !== "organisation-dots" && !isBadge) continue;
        if (isBadge && zoom <= 12 && !marker.isLogo && (marker.count ?? 1) === 1) continue;
        if (!isBadge && zoom >= 13) continue;
        const order = (isBadge ? 4 : 0) + organisationOrder(marker);
        if (order > priority) {
            selected = feature;
            priority = order;
        }
    }

    return selected;
}

/** Keep the pointer inside the card or the triangular approach from its marker. */
export function isPreviewPath(
    point: Point,
    origin: Point,
    card: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    },
) {
    // include a small tolerance around the card and marker
    const left = card.left - 8;
    const right = card.right + 8;
    const top = card.top - 8;
    const bottom = card.bottom + 8;
    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) return true;
    if (Math.hypot(point.x - origin.x, point.y - origin.y) <= 20) return true;

    // cover every approach direction, including popups flipped at viewport edges
    const corners = [
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom },
    ];

    return corners.some((corner, index) => {
        const next = corners[(index + 1) % corners.length];
        const area = cross(origin, corner, next);
        if (Math.abs(area) < 0.001) return false;
        const sides = [
            cross(origin, corner, point),
            cross(corner, next, point),
            cross(next, origin, point),
        ];

        return area > 0 ? sides.every((value) => value >= 0) : sides.every((value) => value <= 0);
    });
}

/** Measure the signed area between three points. */
function cross(first: Point, second: Point, third: Point) {
    return (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);
}
