import sharp from "sharp";
import { site } from "../../src/app/site";

/** Escape authored copy before embedding it in SVG markup. */
function escape(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

/** Wrap the shared description without maintaining a separate social caption. */
const lines: string[] = [];
for (const word of site.description.split(/\s+/)) {
    const last = lines.at(-1);
    if (last && `${last} ${word}`.length <= 49) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
}
if (lines.length > 3) throw new Error("The site description is too long for the social image.");

// Render current branding and copy at the standard social sharing dimensions.
const logo = Buffer.from(
    await Bun.file(new URL("../../src/components/assets/logo.svg", import.meta.url)).arrayBuffer(),
).toString("base64");
const wordmark = Buffer.from(
    await Bun.file(
        new URL("../../src/components/assets/wordmark.svg", import.meta.url),
    ).arrayBuffer(),
).toString("base64");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#174ed8"/>
<image x="64" y="60" width="96" height="96" href="data:image/svg+xml;base64,${logo}"/>
<image x="64" y="210" width="1072" height="150" href="data:image/svg+xml;base64,${wordmark}"/>
<g fill="white" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="400">${lines.map((line, index) => `<text x="64" y="${438 + index * 57}">${escape(line)}</text>`).join("")}</g>
</svg>`;
await sharp(Buffer.from(svg))
    .png()
    .toFile(new URL("../../public/og.png", import.meta.url).pathname);
