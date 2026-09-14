/** Group nearby marker labels in screen space without changing their stored coordinates. */
export function clusterLocations<T extends { id: string; latitude: number; longitude: number }>(
    locations: T[],
    project: (location: T) => { x: number; y: number },
    width = 210,
    height = 64,
): T[][] {
    const groups: T[][] = [];
    for (const location of locations) {
        const point = project(location);
        const group = groups.find((entries) => {
            const anchor = project(entries[0]);
            return Math.abs(point.x - anchor.x) < width && Math.abs(point.y - anchor.y) < height;
        });
        if (group) group.push(location);
        else groups.push([location]);
    }
    return groups;
}
