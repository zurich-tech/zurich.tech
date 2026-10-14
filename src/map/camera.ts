import type { FitBoundsOptions, LngLatBoundsLike } from "maplibre-gl";

/** Frame the city before rendering, using the same bounds for an explicit reset. */
export function overview(
    isHero: boolean,
    width: number,
    height: number,
    isPanelOpen: boolean,
): {
    bounds: LngLatBoundsLike;
    fitBoundsOptions: FitBoundsOptions;
} {
    // reserve panel space without consuming the entire map on short or narrow screens
    const padding =
        width <= 800
            ? width >= 600 && height <= 448 && width > height
                ? { top: 24, right: 60, bottom: 24, left: Math.min(360, width * 0.55) + 16 }
                : { top: 48, right: 24, bottom: isPanelOpen ? height * 0.6 : 180, left: 24 }
            : { top: 64, right: 64, bottom: 64, left: 400 };
    const horizontal = Math.min(1, (width * 0.8) / (padding.left + padding.right));
    const vertical = Math.min(1, (height * 0.8) / (padding.top + padding.bottom));

    return {
        bounds: isHero
            ? [
                  [8.4, 47.3],
                  [8.68, 47.46],
              ]
            : [
                  [8.44, 47.32],
                  [8.64, 47.44],
              ],
        fitBoundsOptions: {
            padding: isHero
                ? 0
                : {
                      top: padding.top * vertical,
                      right: padding.right * horizontal,
                      bottom: padding.bottom * vertical,
                      left: padding.left * horizontal,
                  },
            duration: 0,
            maxZoom: isHero ? 18 : 12,
        },
    };
}
