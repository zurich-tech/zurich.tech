/** A pointer position in viewport coordinates. */
export interface Point {
    x: number;
    y: number;
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
