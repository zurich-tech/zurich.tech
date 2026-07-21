import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

/** One prepared event image and its thumbnail. */
export type EventImage = {
    /** The accessible image description. */
    alt?: string;
    /** The visible image caption. */
    caption?: string;
    /** The rendered image height. */
    height: number;
    /** The immutable full image key. */
    key: string;
    /** The ordered gallery position. */
    position: number;
    /** The immutable thumbnail key. */
    thumbnailKey: string;
    /** The rendered image width. */
    width: number;
};

/** Attach one ordered archive image batch to an event. */
export const attachEventBatch = internalMutation({
    args: {
        images: v.array(
            v.object({
                alt: v.optional(v.string()),
                caption: v.optional(v.string()),
                height: v.number(),
                key: v.string(),
                position: v.number(),
                thumbnailKey: v.string(),
                width: v.number(),
            }),
        ),
        slug: v.string(),
    },
    handler: async (ctx, args) => {
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (query) => query.eq("slug", args.slug))
            .unique();

        // require one real event
        if (event === null) {
            throw new Error(`Event ${args.slug} does not exist.`);
        }

        // validate the complete replacement gallery before writing
        const keys = validateEventImages(args.slug, args.images);

        // load the current event gallery once
        const existing = await ctx.db
            .query("media")
            .withIndex("by_eventId_and_position", (query) => query.eq("eventId", event._id))
            .collect();
        const positioned = new Map(existing.map((media) => [media.position, media]));
        if (positioned.size !== existing.length) {
            throw new Error(`Event ${args.slug} has duplicate media positions.`);
        }

        // preserve one ordered image at each event position
        const ids = [];
        for (const image of args.images) {
            const current = positioned.get(image.position);
            const now = Date.now();
            const fields = {
                alt: image.alt,
                caption: image.caption,
                height: image.height,
                key: image.key,
                kind: "image" as const,
                position: image.position,
                status: "approved" as const,
                thumbnailKey: image.thumbnailKey,
                updatedAt: now,
                uploadedByMemberId: event.ownerMemberId,
                width: image.width,
            };

            // replace an existing position or create the first record
            if (current !== undefined) {
                await ctx.db.patch(current._id, fields);
                ids.push(current._id);
            } else {
                const id = await ctx.db.insert("media", {
                    ...fields,
                    createdAt: now,
                    eventId: event._id,
                });
                ids.push(id);
            }
        }

        // remove positions absent from the replacement batch
        for (const media of existing.filter((item) => item.position >= args.images.length)) {
            await ctx.db.delete(media._id);
        }

        // identify immutable objects no longer referenced by this event
        const removedKeys = existing
            .flatMap((media) => [media.key, media.thumbnailKey])
            .filter((key) => !keys.has(key));

        return { ids, removedKeys };
    },
});

/** Validate one complete ordered event gallery and return its object keys. */
export function validateEventImages(slug: string, images: readonly EventImage[]): Set<string> {
    if (images.length < 1 || images.length > 10) {
        throw new Error("An import batch must contain between 1 and 10 files.");
    }

    // require a dense ordered batch of immutable event objects
    const keys = new Set<string>();
    for (const [position, image] of images.entries()) {
        // validate position and exact rendered dimensions
        const hasValidDimensions =
            Number.isInteger(image.width) &&
            image.width > 0 &&
            Number.isInteger(image.height) &&
            image.height > 0;
        if (image.position !== position || !hasValidDimensions) {
            throw new Error("Media positions must be dense and dimensions must be positive.");
        }

        // constrain the full image to the event's immutable namespace
        const prefix = `events/${slug}/`;
        const filename = image.key.slice(prefix.length);
        if (!image.key.startsWith(prefix) || !/^[a-f0-9]{64}\.webp$/.test(filename)) {
            throw new Error(`Media key ${image.key} is not an immutable event image key.`);
        }

        // constrain the thumbnail to its distinct immutable namespace
        const thumbnailPrefix = `${prefix}thumbnails/`;
        const thumbnailFilename = image.thumbnailKey.slice(thumbnailPrefix.length);
        if (
            !image.thumbnailKey.startsWith(thumbnailPrefix) ||
            !/^[a-f0-9]{64}\.webp$/.test(thumbnailFilename)
        ) {
            throw new Error(`Media key ${image.thumbnailKey} is not an immutable thumbnail key.`);
        }

        // reject duplicate objects within one gallery
        if (keys.has(image.key) || keys.has(image.thumbnailKey)) {
            throw new Error("One media object occurs more than once.");
        }
        keys.add(image.key);
        keys.add(image.thumbnailKey);
    }

    return keys;
}
