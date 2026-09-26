import sharp from "sharp";

// render the email masthead at twice its 600px display width
const width = 1200;
const height = 240;

// crop a band of the city map around the lake
const map = await sharp(
    new URL("../../public/branding/covers/landscape-map.png", import.meta.url).pathname,
)
    .resize(width, Math.round((width / 1920) * 1080))
    .extract({ left: 0, top: 150, width, height })
    .png()
    .toBuffer();

// place the wordmark flush with the bottom and side edges, as on the site
const wordmark = await sharp(
    new URL("../../src/components/assets/wordmark.svg", import.meta.url).pathname,
)
    .resize({ width })
    .png()
    .toBuffer();
const dimensions = await sharp(wordmark).metadata();

await sharp(map)
    .composite([{ input: wordmark, left: 0, top: height - dimensions.height! }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(new URL("../../public/branding/mail.png", import.meta.url).pathname);
