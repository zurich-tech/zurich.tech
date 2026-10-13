import sharp from "sharp";
import { copyFile } from "node:fs/promises";

// frame the map at standard social sharing dimensions
const width = 1200;
const height = 630;
const map = await sharp(
    new URL("../../public/branding/covers/landscape-map.png", import.meta.url).pathname,
)
    .resize(width, height)
    .removeAlpha()
    .linear([0.3, 0.3, 0.3], [23 * 0.7, 78 * 0.7, 216 * 0.7])
    .png()
    .toBuffer();

// place the website wordmark flush with the bottom and side edges
const wordmark = await sharp(
    new URL("../../src/components/assets/wordmark.svg", import.meta.url).pathname,
)
    .resize({ width })
    .png()
    .toBuffer();
const dimensions = await sharp(wordmark).metadata();

// identify the community above the map
const logo = await sharp(new URL("../../src/components/assets/logo.svg", import.meta.url).pathname)
    .resize(80, 80)
    .png()
    .toBuffer();
await sharp(map)
    .composite([
        { input: logo, left: 40, top: 40 },
        { input: wordmark, left: 0, top: height - dimensions.height! },
    ])
    .png()
    .toFile(new URL("../../src/components/assets/og.png", import.meta.url).pathname);

// retain the original public URL for previously shared previews
await copyFile(
    new URL("../../src/components/assets/og.png", import.meta.url),
    new URL("../../public/og.png", import.meta.url),
);
