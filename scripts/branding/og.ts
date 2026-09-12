import sharp from "sharp";

// frame the map at standard social sharing dimensions
const width = 1200;
const height = 630;
const map = await sharp(
    new URL("../../public/branding/covers/landscape-map.png", import.meta.url).pathname,
)
    .resize(width, height)
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
await sharp(map)
    .composite([{ input: wordmark, left: 0, top: height - dimensions.height! }])
    .png()
    .toFile(new URL("../../public/og.png", import.meta.url).pathname);
