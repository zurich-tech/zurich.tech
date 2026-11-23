import { Buffer } from "node:buffer";
import { create, type Font } from "fontkit";
import { Resvg } from "@cf-wasm/resvg";
import { imageDate, speakerGroups, type SharedEvent } from "../events/sharing";

/** Fonts and images loaded from the deployment's own static assets. */
export type PosterAssets = {
    regular: ArrayBuffer;
    bold: ArrayBuffer;
    heading: ArrayBuffer;
    map: string;
    logo: string;
};

/** Read a single bundled font with its OpenType shaping tables. */
export function posterFont(bytes: ArrayBuffer): Font {
    const font = create(Buffer.from(bytes));
    if (!("layout" in font)) throw new Error("sharing font must contain a single face");

    return font;
}

/** Measure the shaped glyph run in image pixels. */
export function textWidth(text: string, font: Font, size: number) {
    return (font.layout(text).advanceWidth * size) / font.unitsPerEm;
}

/** Draw the same shaped glyph run used for measurement. */
function textPath(value: string, font: Font, size: number, x: number, baseline: number) {
    const run = font.layout(value);
    const scale = size / font.unitsPerEm;
    let advance = 0;
    const paths = run.glyphs.map((glyph, index) => {
        const position = run.positions[index]!;
        const left = x + (advance + position.xOffset) * scale;
        const top = baseline - position.yOffset * scale;
        advance += position.xAdvance;

        return `<path transform="translate(${left} ${top}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
    });

    return paths.join("");
}

/** Bound a text block by measured glyph widths, with explicit ellipsis for overflow. */
export function textLines(text: string, font: Font, size: number, width: number, limit: number) {
    const lines: string[] = [];
    let line = "";
    for (const word of text.trim().split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (line && textWidth(next, font, size) > width) {
            lines.push(line);
            line = word;
        } else line = next;
    }
    if (line) lines.push(line);

    // preserve the layout even for a single unbroken name or a very long title
    const visible = lines.slice(0, limit);
    return visible.map((value, index) => {
        const isTruncated = index === limit - 1 && lines.length > limit;
        if (!isTruncated && textWidth(value, font, size) <= width) return value;
        const characters = Array.from(value);
        while (characters.length && textWidth(`${characters.join("")}…`, font, size) > width)
            characters.pop();

        return `${characters.join("").trimEnd()}…`;
    });
}

/** Draw the fixed sharing-image grid with the actual font outlines. */
export function posterSvg(
    event: SharedEvent,
    assets: PosterAssets,
    portraits: Map<string, string>,
) {
    const regular = posterFont(assets.regular);
    const bold = posterFont(assets.bold);
    const heading = posterFont(assets.heading);
    const groups = speakerGroups(event);
    const elements = [`<image href="${assets.map}" width="1200" height="630"/>`];

    // allow long event names two lines without encroaching on the speakers
    const label = event.status === "cancelled" ? `Cancelled: ${event.title}` : event.title;
    const titleSize = textWidth(label, heading, 88) <= 1104 ? 88 : 58;
    const title = textLines(label, heading, titleSize, 1104, 2);
    title.forEach((line, index) =>
        elements.push(textPath(line, heading, titleSize, 48, 115 + index * 64)),
    );
    const top = title.length === 1 ? 184 : 224;
    const bottom = 502;

    // reserve a common portrait column only when at least one portrait is available
    const shown = groups.length <= 3 ? groups : [];
    const portraitCount = Math.min(
        2,
        Math.max(
            0,
            ...shown.map(
                (group) =>
                    group.filter((person) => person.imageUrl && portraits.has(person.imageUrl))
                        .length,
            ),
        ),
    );
    const textLeft = 48 + (portraitCount ? portraitCount * 112 + 16 : 0);
    const rowHeight = shown.length ? (bottom - top - 32 * (shown.length - 1)) / shown.length : 0;
    const size = shown.length === 3 ? 34 : 42;
    shown.forEach((group, index) => {
        const middle = top + index * (rowHeight + 32) + rowHeight / 2;
        const names = textLines(
            group.map((person) => person.name).join(" + "),
            bold,
            size,
            1152 - textLeft,
            rowHeight >= size * 1.16 * 3 ? 2 : 1,
        );
        const organisations = [
            ...new Set(
                group.flatMap((person) =>
                    (person.affiliations ?? []).map((item) => item.organisation).filter(Boolean),
                ),
            ),
        ];
        const affiliation = textLines(organisations.join(" / "), regular, size, 1152 - textLeft, 1);
        const height = (names.length + affiliation.length) * size * 1.16;
        let baseline = middle - height / 2 + size * 0.9;
        for (const name of names) {
            elements.push(textPath(name, bold, size, textLeft, baseline));
            baseline += size * 1.16;
        }
        for (const name of affiliation)
            elements.push(textPath(name, regular, size, textLeft, baseline));

        // render optional portraits beside their own speaker group
        group
            .filter((person) => person.imageUrl && portraits.has(person.imageUrl))
            .slice(0, 2)
            .forEach((person, position) => {
                const left = 48 + position * 112;
                const diameter = shown.length === 3 ? 80 : 104;
                const clip = `portrait-${index}-${position}`;
                elements.push(
                    `<defs><clipPath id="${clip}"><circle cx="${left + diameter / 2}" cy="${middle}" r="${diameter / 2}"/></clipPath></defs><image href="${portraits.get(person.imageUrl!)}" x="${left}" y="${middle - diameter / 2}" width="${diameter}" height="${diameter}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})"/><circle cx="${left + diameter / 2}" cy="${middle}" r="${diameter / 2 - 1}" fill="none" stroke="white" stroke-opacity=".65" stroke-width="2"/>`,
                );
            });
    });

    // keep large programmes legible rather than shrinking every speaker to unreadable text
    if (groups.length > 3)
        elements.push(textPath(`${event.speakers.length} speakers`, bold, 58, 48, 330));

    // align the compact logo and full date on the same footer centreline
    elements.push(`<image href="${assets.logo}" x="48" y="534" width="48" height="48"/>`);
    elements.push(textPath("zurich.tech", heading, 38, 112, 574));
    const date = imageDate(event.startsAt);
    elements.push(textPath(date, regular, 42, 1152 - textWidth(date, regular, 42), 574));

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#174ed8"/><g fill="white">${elements.join("")}</g></svg>`;
}

/** Rasterise the self-contained image, releasing WASM allocations after each render. */
export async function posterPng(svg: string) {
    const renderer = await Resvg.async(svg, { font: { loadSystemFonts: false } });
    try {
        const image = renderer.render();
        try {
            return new Uint8Array(image.asPng());
        } finally {
            image.free();
        }
    } finally {
        renderer.free();
    }
}
