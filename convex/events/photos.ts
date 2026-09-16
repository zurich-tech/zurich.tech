import { v } from "convex/values";

import {
    action,
    internalQuery,
    internalMutation,
    mutation,
    type QueryCtx,
    type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { permissions } from "../auth/grants";
import { allows } from "../auth/permissions";
import type { Doc, Id } from "../_generated/dataModel";

/** Resolve either archived objects or authenticated browser uploads. */
export async function photoUrls(ctx: QueryCtx, photo: Doc<"photos">) {
    if ("key" in photo)
        return {
            url: `https://media.zurich.tech/${photo.key}`,
            thumbnailUrl: `https://media.zurich.tech/${photo.thumbnailKey}`,
        };
    const [url, thumbnailUrl] = await Promise.all([
        ctx.storage.getUrl(photo.storageId),
        ctx.storage.getUrl(photo.thumbnailId),
    ]);
    if (!url || !thumbnailUrl) throw new Error("Photo file is missing.");
    return { url, thumbnailUrl };
}

/** Only explicit team accounts and event organisers may publish photographs. */
async function requirePhotos(ctx: QueryCtx | MutationCtx, eventId: Id<"events">) {
    const access = await permissions(ctx);
    const event = await ctx.db.get(eventId);
    if (
        !event ||
        !(
            access.account.isTeam ||
            allows(access, { eventId, seriesId: event.seriesId }, "organiser")
        )
    )
        throw new Error("Team or organiser access is required to manage photos.");
    return access.account;
}

/** Check authority before accepting image bytes. */
export const authorise = internalQuery({
    args: { eventId: v.id("events") },
    handler: async (ctx, { eventId }) => {
        await requirePhotos(ctx, eventId);
    },
});

/** Store one normalised image and thumbnail, then atomically append its public record. */
export const upload = action({
    args: {
        eventId: v.id("events"),
        bytes: v.bytes(),
        thumbnail: v.bytes(),
        width: v.number(),
        height: v.number(),
    },
    handler: async (ctx, args): Promise<void> => {
        await ctx.runQuery(internal.events.photos.authorise, { eventId: args.eventId });
        for (const [buffer, limit] of [
            [args.bytes, 4000000],
            [args.thumbnail, 1000000],
        ] as const) {
            const bytes = new Uint8Array(buffer);
            const text = (start: number, end: number) =>
                String.fromCharCode(...bytes.slice(start, end));
            if (
                bytes.length < 16 ||
                bytes.length > limit ||
                text(0, 4) !== "RIFF" ||
                text(8, 12) !== "WEBP"
            )
                throw new Error("Choose a valid WebP image within the upload size limit.");
        }
        if (
            ![args.width, args.height].every(
                (value) => Number.isInteger(value) && value > 0 && value <= 2000,
            )
        )
            throw new Error("Photo dimensions must be between 1 and 2000 pixels.");

        // Roll back stored files if either storage or publication fails.
        const ids: Id<"_storage">[] = [];
        try {
            ids.push(await ctx.storage.store(new Blob([args.bytes], { type: "image/webp" })));
            ids.push(await ctx.storage.store(new Blob([args.thumbnail], { type: "image/webp" })));
            await ctx.runMutation(internal.events.photos.attach, {
                eventId: args.eventId,
                storageId: ids[0]!,
                thumbnailId: ids[1]!,
                width: args.width,
                height: args.height,
            });
        } catch (error) {
            await Promise.all(ids.map((id) => ctx.storage.delete(id)));
            throw error;
        }
    },
});

/** Recheck access and allocate position transactionally, including concurrent uploads. */
export const attach = internalMutation({
    args: {
        eventId: v.id("events"),
        storageId: v.id("_storage"),
        thumbnailId: v.id("_storage"),
        width: v.number(),
        height: v.number(),
    },
    handler: async (ctx, args) => {
        const account = await requirePhotos(ctx, args.eventId);
        const last = await ctx.db
            .query("photos")
            .withIndex("by_event_and_position", (q) => q.eq("eventId", args.eventId))
            .order("desc")
            .first();
        await ctx.db.insert("photos", {
            ...args,
            uploaderId: account.memberId,
            position: (last?.position ?? -1) + 1,
            status: "approved",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

/** Remove a published photo using the same authority as uploading. */
export const remove = mutation({
    args: { id: v.id("photos") },
    handler: async (ctx, { id }) => {
        const photo = await ctx.db.get(id);
        if (!photo) throw new Error("Photo not found.");
        await requirePhotos(ctx, photo.eventId);
        if ("storageId" in photo) {
            await ctx.storage.delete(photo.storageId);
            await ctx.storage.delete(photo.thumbnailId);
        }
        await ctx.db.delete(id);
    },
});

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
            .query("photos")
            .withIndex("by_event_and_position", (query) => query.eq("eventId", event._id))
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
                position: image.position,
                status: "approved" as const,
                thumbnailKey: image.thumbnailKey,
                updatedAt: now,
                uploaderId: event.ownerId,
                width: image.width,
            };

            // replace an existing position or create the first record
            if (current !== undefined) {
                if ("storageId" in current) {
                    await ctx.storage.delete(current.storageId);
                    await ctx.storage.delete(current.thumbnailId);
                }
                await ctx.db.replace(current._id, {
                    ...fields,
                    eventId: event._id,
                    createdAt: current.createdAt,
                });
                ids.push(current._id);
            } else {
                const id = await ctx.db.insert("photos", {
                    ...fields,
                    createdAt: now,
                    eventId: event._id,
                });
                ids.push(id);
            }
        }

        // remove positions absent from the replacement batch
        for (const media of existing.filter((item) => item.position >= args.images.length)) {
            if ("storageId" in media) {
                await ctx.storage.delete(media.storageId);
                await ctx.storage.delete(media.thumbnailId);
            }
            await ctx.db.delete(media._id);
        }

        // identify immutable objects no longer referenced by this event
        const removedKeys = existing
            .flatMap((media) => ("key" in media ? [media.key, media.thumbnailKey] : []))
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
