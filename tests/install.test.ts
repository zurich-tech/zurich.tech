import { expect, test } from "bun:test";
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
    await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
);

test("provide a standalone app with public navigation shortcuts", () => {
    expect({
        id: manifest.id,
        start: manifest.start_url,
        scope: manifest.scope,
        display: manifest.display,
        shortcuts: manifest.shortcuts,
    }).toEqual({
        id: "/",
        start: "/",
        scope: "/",
        display: "standalone",
        shortcuts: [
            { name: "Events", url: "/events" },
            { name: "Map", url: "/map" },
        ],
    });
});

test("ship app icons at their declared dimensions", async () => {
    for (const icon of manifest.icons) {
        const image = await sharp(
            new URL(`../public${icon.src}`, import.meta.url).pathname,
        ).metadata();
        expect(`${image.width}x${image.height}`).toBe(icon.sizes);
        expect(image.format).toBe("png");
    }
    expect(
        manifest.icons.filter((icon: { purpose?: string }) => icon.purpose === "maskable"),
    ).toEqual([
        { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
});
