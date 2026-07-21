import { describe, expect, test } from "bun:test";

import { type EventImage, validateEventImages } from "../convex/media";

const firstHash = "a".repeat(64);
const secondHash = "b".repeat(64);

/** Build one valid image at the requested gallery position. */
function image(position: number): EventImage {
    return {
        height: 900,
        key: `events/zurichnlp-1/${firstHash}.webp`,
        position,
        thumbnailKey: `events/zurichnlp-1/thumbnails/${secondHash}.webp`,
        width: 1_600,
    };
}

describe("event media", () => {
    test("test_validate_event_image_keys", () => {
        const keys = validateEventImages("zurichnlp-1", [image(0)]);

        expect([...keys]).toEqual([
            `events/zurichnlp-1/${firstHash}.webp`,
            `events/zurichnlp-1/thumbnails/${secondHash}.webp`,
        ]);
    });

    test("test_reject_empty_event_gallery", () => {
        expect(() => validateEventImages("zurichnlp-1", [])).toThrow(
            "An import batch must contain between 1 and 10 files.",
        );
    });

    test("test_reject_sparse_event_gallery", () => {
        expect(() => validateEventImages("zurichnlp-1", [image(1)])).toThrow(
            "Media positions must be dense and dimensions must be positive.",
        );
    });

    test("test_reject_invalid_event_image_dimensions", () => {
        const invalid = { ...image(0), width: Number.NaN };

        expect(() => validateEventImages("zurichnlp-1", [invalid])).toThrow(
            "Media positions must be dense and dimensions must be positive.",
        );
    });

    test("test_reject_foreign_event_image", () => {
        const foreign = { ...image(0), key: `events/zurichcv-1/${firstHash}.webp` };

        expect(() => validateEventImages("zurichnlp-1", [foreign])).toThrow(
            `Media key ${foreign.key} is not an immutable event image key.`,
        );
    });

    test("test_reject_duplicate_event_image", () => {
        expect(() => validateEventImages("zurichnlp-1", [image(0), image(1)])).toThrow(
            "One media object occurs more than once.",
        );
    });
});
