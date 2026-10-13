/** Read a logo's background from a small raster sample. */
export function logoBackground(image: HTMLImageElement): string {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(image, 0, 0, 16, 16);

    return cornerColour(context.getImageData(0, 0, 16, 16));
}

/** Use matching opaque corners as the background; keep transparent or varied artwork on white. */
export function cornerColour(image: ImageData): string {
    const corners = [
        0,
        image.width - 1,
        image.width * (image.height - 1),
        image.width * image.height - 1,
    ];
    const colours = corners.map((pixel) => Array.from(image.data.slice(pixel * 4, pixel * 4 + 4)));
    if (colours.some((colour) => colour[3] < 250)) return "#ffffff";

    // reject photographs and artwork without a consistent background
    const channels = [0, 1, 2].map((channel) => colours.map((colour) => colour[channel]));
    if (channels.some((values) => Math.max(...values) - Math.min(...values) > 16)) return "#ffffff";
    const colour = channels.map((values) =>
        Math.round(values.reduce((sum, value) => sum + value, 0) / 4),
    );

    return `rgb(${colour.join(", ")})`;
}
