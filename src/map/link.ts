import type { Map as GeographicMap } from "maplibre-gl";

/** A validated, north-up map camera encoded as longitude, latitude and zoom. */
export type MapCamera = { center: [number, number]; zoom: number };

/** Capture the visible centre independently of temporary panel padding. */
export function currentCamera(map: GeographicMap): MapCamera {
    const canvas = map.getCanvas();
    const center = map
        .unproject([canvas.clientWidth / 2, canvas.clientHeight / 2])
        .wrap()
        .toArray();

    return { center, zoom: map.getZoom() };
}

/** Ignore malformed external cameras rather than passing invalid coordinates to WebGL. */
export function readCamera(value: unknown): MapCamera | undefined {
    if (typeof value !== "string") return;
    const fields = value.split(",");
    if (fields.length !== 3 || fields.some((field) => !field.trim())) return;
    const [longitude, latitude, zoom] = fields.map(Number);
    if (
        !Number.isFinite(longitude) ||
        Math.abs(longitude) > 180 ||
        !Number.isFinite(latitude) ||
        Math.abs(latitude) > 85.051129 ||
        !Number.isFinite(zoom) ||
        zoom < 3 ||
        zoom > 18
    )
        return;

    return { center: [longitude, latitude], zoom };
}

/** Retain metre-scale location precision without long floating-point URLs. */
export function cameraParameter(camera: MapCamera): string {
    return [...camera.center.map((value) => value.toFixed(5)), camera.zoom.toFixed(2)].join(",");
}
