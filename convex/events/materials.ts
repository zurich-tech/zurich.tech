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
import type { Id } from "../_generated/dataModel";
import { permissions } from "../auth/grants";
import { allows } from "../auth/permissions";
import { maximumMaterialBytes } from "./fields";

/** Require event organiser or team authority before changing public materials. */
async function requireMaterials(ctx: QueryCtx | MutationCtx, eventId: Id<"events">) {
    const access = await permissions(ctx);
    const event = await ctx.db.get(eventId);
    if (
        !event ||
        !(
            access.account.isTeam ||
            access.account.isAdmin ||
            allows(access, { eventId, seriesId: event.seriesId }, "organiser")
        )
    )
        throw new ConvexError("organiser access is required to manage materials");

    return event;
}

/** Check access before accepting file bytes. */
export const authorise = internalQuery({
    args: { eventId: v.id("events") },
    handler: async (ctx, { eventId }) => {
        await requireMaterials(ctx, eventId);
    },
});

/** Upload a public PDF and remove stored bytes if publication fails. */
export const upload = action({
    args: { eventId: v.id("events"), title: v.string(), bytes: v.bytes() },
    handler: async (ctx, { eventId, title, bytes }): Promise<void> => {
        await ctx.runQuery(internal.events.materials.authorise, { eventId });
        title = title.trim();
        if (!title || title.length > 100)
            throw new ConvexError("enter a title of up to 100 characters");
        if (
            bytes.byteLength > maximumMaterialBytes ||
            new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
        )
            throw new ConvexError("choose a PDF under 8 MB");

        // publish only after storage succeeds
        const storageId = await ctx.storage.store(new Blob([bytes], { type: "application/pdf" }));
        try {
            await ctx.runMutation(internal.events.materials.attach, { eventId, title, storageId });
        } catch (error) {
            await ctx.storage.delete(storageId);
            throw error;
        }
    },
});

/** Append the file transactionally after rechecking organiser access. */
export const attach = internalMutation({
    args: { eventId: v.id("events"), title: v.string(), storageId: v.id("_storage") },
    handler: async (ctx, { eventId, ...material }) => {
        const event = await requireMaterials(ctx, eventId);
        const materials = event.materials ?? [];
        if (materials.length >= 10) throw new ConvexError("an event can have up to 10 materials");
        await ctx.db.patch(eventId, { materials: [...materials, material] });
    },
});

/** Delete only a file attached to the authorised event. */
export const remove = mutation({
    args: { eventId: v.id("events"), storageId: v.id("_storage") },
    handler: async (ctx, { eventId, storageId }) => {
        const event = await requireMaterials(ctx, eventId);
        const materials = event.materials ?? [];
        if (!materials.some((material) => material.storageId === storageId))
            throw new ConvexError("event material not found");
        await ctx.db.patch(eventId, {
            materials: materials.filter((material) => material.storageId !== storageId),
        });
        await ctx.storage.delete(storageId);
    },
});
