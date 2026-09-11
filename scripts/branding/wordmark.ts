import { parse } from "opentype.js";

// Outline the exact hero typeface so rendering never depends on a fallback font.
const font = parse(
    await Bun.file(new URL("./fonts/JetBrainsMono-ExtraBold.ttf", import.meta.url)).arrayBuffer(),
);
const paths = [];
let cursor = 0;
let left = Infinity;
let top = Infinity;
let right = -Infinity;
for (const character of "zurich.tech") {
    const glyph = font.charToGlyph(character);
    const advance = (glyph.advanceWidth / font.unitsPerEm) * 1000;
    if (character === ".") {
        paths.push(`<rect x="${cursor + (advance - 240) / 2}" y="-240" width="240" height="240"/>`);
    } else {
        const path = glyph.getPath(cursor, 0, 1000);
        const bounds = path.getBoundingBox();
        left = Math.min(left, bounds.x1);
        top = Math.min(top, bounds.y1);
        right = Math.max(right, bounds.x2);
        paths.push(`<path d="${path.toPathData(3)}"/>`);
    }
    cursor += advance - 65;
}
// Crop at the baseline and slightly into the outer strokes so the ink meets the banner edges.
const bleed = 5;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left + bleed} ${top} ${right - left - bleed * 2} ${-top}" fill="white">${paths.join("")}</svg>`;
await Bun.write(new URL("../../src/components/assets/wordmark.svg", import.meta.url), svg);
