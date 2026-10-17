import { ConvexError, v } from "convex/values";

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
        throw new ConvexError("Team or organiser access is required to manage photos.");
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
                throw new ConvexError("Choose a valid WebP image within the upload size limit.");
        }
        if (
            ![args.width, args.height].every(
                (value) => Number.isInteger(value) && value > 0 && value <= 2000,
            )
        )
            throw new ConvexError("Photo dimensions must be between 1 and 2000 pixels.");

        // roll back stored files if either storage or publication fails
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
        if (!photo) throw new ConvexError("Photo not found.");
        await requirePhotos(ctx, photo.eventId);
        if ("storageId" in photo) {
            await ctx.storage.delete(photo.storageId);
            await ctx.storage.delete(photo.thumbnailId);
        }
        await ctx.db.delete(id);
    },
});
