import { expect, test } from "bun:test";
import { cameraParameter, readCamera } from "../src/map/link";

test("map links round trip camera precision", () => {
    const encoded = cameraParameter({ center: [8.5432123, 47.3787654], zoom: 13.456 });
    expect(encoded).toBe("8.54321,47.37877,13.46");
    expect(readCamera(encoded)).toEqual({ center: [8.54321, 47.37877], zoom: 13.46 });
});

test("map links reject invalid external camera values", () => {
    for (const value of [
        undefined,
        [],
        "",
        "8,47",
        "8,47,12,0",
        "8,,12",
        "NaN,47,12",
        "8,Infinity,12",
        "181,47,12",
        "8,86,12",
        "8,47,19",
        "8,47,2",
    ])
        expect(readCamera(value)).toBeUndefined();
    expect(readCamera("-180,-85,3")).toEqual({ center: [-180, -85], zoom: 3 });
});
