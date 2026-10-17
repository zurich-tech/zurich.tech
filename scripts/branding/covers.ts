import sharp from "sharp";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { mkdir } from "node:fs/promises";

/** Export dimensions published by the platforms, plus a general landscape cover. */
const formats = [
    { name: "linkedin-profile", width: 1584, height: 396 },
    { name: "linkedin-page", width: 4200, height: 700 },
    { name: "x", width: 1500, height: 500 },
    { name: "landscape", width: 1920, height: 1080 },
];
const directory = new URL("../../public/branding/covers/", import.meta.url).pathname;
const zoom = 12;
const count = 2 ** zoom;
const center = [((8.54 + 180) / 360) * count, mercator(47.38) * count];
const span = (0.44 / 360) * count;
const tiles = new Map<string, VectorTile>();
const source = await (await fetch("https://tiles.openfreemap.org/planet")).json();
await mkdir(directory, { recursive: true });

/** Project latitude to the normalized vertical coordinate used by vector tiles. */
function mercator(latitude: number) {
    const angle = (latitude * Math.PI) / 180;

    return (1 - Math.asinh(Math.tan(angle)) / Math.PI) / 2;
}

// frame each aspect ratio directly instead of stretching or cropping a single raster
for (const format of formats) {
    const { width, height } = format;
    const scale = width / span;
    const left = center[0] - span / 2;
    const top = center[1] - height / scale / 2;
    const groups: string[] = [];
    for (let y = Math.floor(top); y <= Math.floor(top + height / scale); y++) {
        for (let x = Math.floor(left); x <= Math.floor(left + span); x++) {
            const key = `${zoom}/${x}/${y}`;
            if (!tiles.has(key)) {
                const url = source.tiles[0]
                    .replace("{z}", zoom)
                    .replace("{x}", x)
                    .replace("{y}", y);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Map tile ${key}: ${response.status}`);
                tiles.set(
                    key,
                    new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer()))),
                );
            }
            const tile = tiles.get(key)!;
            const paths: string[] = [];
            for (const name of ["water", "waterway", "transportation"]) {
                const layer = tile.layers[name];
                if (!layer) continue;
                for (let index = 0; index < layer.length; index++) {
                    const feature = layer.feature(index);
                    if (name === "transportation" && feature.properties.class === "ferry") continue;
                    const coordinates = feature.loadGeometry();
                    const path = coordinates
                        .map(
                            (ring) =>
                                ring
                                    .map(
                                        (point, index) =>
                                            `${index ? "L" : "M"}${((point.x / layer.extent) * scale).toFixed(2)},${((point.y / layer.extent) * scale).toFixed(2)}`,
                                    )
                                    .join(" ") + (feature.type === 3 ? "Z" : ""),
                        )
                        .join(" ");
                    const stroke = Math.max(0.6, width / 1600);
                    const paint =
                        name === "water"
                            ? 'fill="#4170df" fill-rule="evenodd" stroke="#fff"'
                            : `fill="none" stroke="#fff" stroke-opacity="${feature.properties.class === "rail" ? 0.3 : 0.7}"`;
                    paths.push(`<path d="${path}" ${paint} stroke-width="${stroke}"/>`);
                }
            }
            const id = `tile-${x}-${y}`;
            groups.push(
                `<g transform="translate(${(x - left) * scale},${(y - top) * scale})"><defs><clipPath id="${id}"><rect width="${scale}" height="${scale}"/></clipPath></defs><g clip-path="url(#${id})">${paths.join("")}</g></g>`,
            );
        }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#174ed8"/>${groups.join("")}</svg>`;
    const map = await sharp(Buffer.from(svg)).png().toBuffer();
    await Bun.write(`${directory}${format.name}-map.png`, map);

    // use the same outlined wordmark as the website, flush with the banner edges
    const wordmark = await sharp(
        new URL("../../src/components/assets/wordmark.svg", import.meta.url).pathname,
    )
        .resize({ width })
        .png()
        .toBuffer();
    const dimensions = await sharp(wordmark).metadata();
    await sharp(map)
        .composite([
            {
                input: wordmark,
                left: 0,
                top: height - dimensions.height!,
            },
        ])
        .png()
        .toFile(`${directory}${format.name}.png`);
    console.log(`${format.name}: ${width}×${height}`);
}
