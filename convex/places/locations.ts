import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { requireAccount } from "../auth/access";
import { requireOrganisation } from "../organisations/mutations";

/** Authorize a location through its member or organisation owner. */
async function requireOwner(
    ctx: QueryCtx | MutationCtx,
    ownerId: Id<"members"> | Id<"organisations">,
) {
    const viewer = await requireAccount(ctx);
    const organisationId = ctx.db.normalizeId("organisations", ownerId);
    if (organisationId)
        return { ...(await requireOrganisation(ctx, organisationId)), isOrganisation: true };
    if (ownerId !== viewer.memberId && !viewer.isAdmin)
        throw new ConvexError("You cannot manage this location.");
    if (!(await ctx.db.get(ownerId))) throw new Error("Location owner is missing.");
    return { viewer, isOrganisation: false };
}

/** Add or update a public location without granting sponsorship privileges. */
export const save = mutation({
    args: {
        id: v.optional(v.id("locations")),
        ownerId: v.union(v.id("organisations"), v.id("members")),
        name: v.string(),
        line1: v.string(),
        locality: v.string(),
        postalCode: v.optional(v.string()),
        countryCode: v.string(),
        latitude: v.number(),
        longitude: v.number(),
    },
    handler: async (ctx, args) => {
        const { isOrganisation } = await requireOwner(ctx, args.ownerId);
        if (
            !args.name.trim() ||
            !args.line1.trim() ||
            !args.locality.trim() ||
            !/^[A-Z]{2}$/.test(args.countryCode) ||
            !Number.isFinite(args.latitude) ||
            Math.abs(args.latitude) > 90 ||
            !Number.isFinite(args.longitude) ||
            Math.abs(args.longitude) > 180
        )
            throw new ConvexError("Enter a valid address and coordinates.");
        const existing = args.id ? await ctx.db.get(args.id) : null;
        if (args.id && (!existing || existing.ownerId !== args.ownerId))
            throw new ConvexError("Location not found.");
        const address = {
            line1: args.line1.trim(),
            locality: args.locality.trim(),
            postalCode: args.postalCode?.trim() || undefined,
            countryCode: args.countryCode,
            latitude: args.latitude,
            longitude: args.longitude,
            updatedAt: Date.now(),
        };

        // copy shared addresses so an office edit cannot alter an event venue
        if (existing) {
            const sharedVenue = await ctx.db
                .query("venues")
                .withIndex("by_address", (q) => q.eq("addressId", existing.addressId))
                .first();
            const sharedLocation = await ctx.db
                .query("locations")
                .withIndex("by_address", (q) => q.eq("addressId", existing.addressId))
                .filter((q) => q.neq(q.field("_id"), existing._id))
                .first();
            if (sharedVenue || sharedLocation) {
                const addressId = await ctx.db.insert("addresses", {
                    ...address,
                    createdAt: Date.now(),
                });
                await ctx.db.patch(existing._id, { addressId });
            } else {
                await ctx.db.patch(existing.addressId, address);
            }
            await ctx.db.patch(existing._id, { name: args.name.trim() });
            return existing._id;
        }
        const addressId = await ctx.db.insert("addresses", { ...address, createdAt: Date.now() });
        return await ctx.db.insert("locations", {
            ownerId: args.ownerId,
            visibility: isOrganisation ? "public" : "private",
            addressId,
            name: args.name.trim(),
        });
    },
});

/** Read locations for an organisation the current account can manage. */
export const list = query({
    args: { ownerId: v.union(v.id("organisations"), v.id("members")) },
    handler: async (ctx, args) => {
        await requireOwner(ctx, args.ownerId);
        const rows = await ctx.db
            .query("locations")
            .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
            .collect();
        return await Promise.all(
            rows.map(async (row) => ({ ...row, address: await ctx.db.get(row.addressId) })),
        );
    },
});

/** Remove an organisation location from its profile and the map. */
export const remove = mutation({
    args: { id: v.id("locations") },
    handler: async (ctx, args) => {
        const location = await ctx.db.get(args.id);
        if (!location) throw new ConvexError("Location not found.");
        await requireOwner(ctx, location.ownerId);
        await ctx.db.delete(location._id);
    },
});
