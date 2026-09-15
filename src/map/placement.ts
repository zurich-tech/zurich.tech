/** A logo anchored to a geographic location, with its rendered diameter. */
export interface MapLogo {
    id: string;
    x: number;
    y: number;
    size: number;
}

/** Place visible logos within a finite viewport, reporting any that cannot fit. */
export function arrangeLogos<T extends MapLogo>(
    logos: T[],
    viewport: { width: number; height: number },
) {
    const placed: (T & { offset: [number, number] })[] = [];
    const crowded: T[] = [];
    if (!logos.length) return { placed, crowded };

    // a cell accommodates the largest logo; neighbouring buckets suffice for collision checks
    const cell = Math.max(...logos.map((logo) => logo.size)) + 3;
    const columns = Math.floor(viewport.width / cell);
    const rows = Math.floor(viewport.height / cell);
    const buckets = new Map<number, { x: number; y: number; size: number }[]>();
    for (const logo of logos) {
        // offscreen addresses remain in the directory without pulling their logos onto the edge
        if (logo.x < 0 || logo.y < 0 || logo.x > viewport.width || logo.y > viewport.height)
            continue;
        const radius = logo.size / 2;
        const x = Math.max(radius, Math.min(viewport.width - radius, logo.x));
        const y = Math.max(radius, Math.min(viewport.height - radius, logo.y));
        let position = fits(x, y, logo.size, viewport, cell, buckets) ? { x, y } : undefined;

        // inspect each finite grid position at most once, choosing the closest available one
        if (!position) {
            let distance = Infinity;
            for (let row = 0; row < rows; row++) {
                for (let column = 0; column < columns; column++) {
                    const candidate = { x: (column + 0.5) * cell, y: (row + 0.5) * cell };
                    const squared = (candidate.x - logo.x) ** 2 + (candidate.y - logo.y) ** 2;
                    if (
                        squared < distance &&
                        fits(candidate.x, candidate.y, logo.size, viewport, cell, buckets)
                    ) {
                        distance = squared;
                        position = candidate;
                    }
                }
            }
        }
        if (!position) {
            crowded.push(logo);
            continue;
        }

        // retain the true anchor and index only the drawn circle for subsequent collisions
        placed.push({ ...logo, offset: [position.x - logo.x, position.y - logo.y] });
        const key = Math.floor(position.y / cell) * (columns + 2) + Math.floor(position.x / cell);
        const bucket = buckets.get(key) ?? [];
        bucket.push({ ...position, size: logo.size });
        buckets.set(key, bucket);
    }
    return { placed, crowded };
}

/** Check bounds and only the spatial buckets which can intersect this circle. */
function fits(
    x: number,
    y: number,
    size: number,
    viewport: { width: number; height: number },
    cell: number,
    buckets: Map<number, { x: number; y: number; size: number }[]>,
) {
    const radius = size / 2;
    if (x < radius || y < radius || x + radius > viewport.width || y + radius > viewport.height)
        return false;
    const column = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    const stride = Math.floor(viewport.width / cell) + 2;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (column + dx < 0 || row + dy < 0) continue;
            for (const other of buckets.get((row + dy) * stride + column + dx) ?? []) {
                if ((x - other.x) ** 2 + (y - other.y) ** 2 < ((size + other.size) / 2 + 3) ** 2)
                    return false;
            }
        }
    }
    return true;
}
