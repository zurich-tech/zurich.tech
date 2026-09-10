import { v } from "convex/values";
import {
    internalMutation,
    mutation,
    query,
    type QueryCtx,
    type MutationCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { normalizeEmail } from "./email";
import { requireAccount, requireTeam } from "./access";
import { normalizeUrl, normalizeImageUrl, socialLinks, normalizeSocialLinks } from "./url";

/** Upsert a curated organisation. */
export const upsert = mutation({
    args: {
        id: v.optional(v.id("organisations")),
        slug: v.string(),
        name: v.string(),
        description: v.string(),
        kind: v.union(
            v.literal("company"),
            v.literal("lab"),
            v.literal("community"),
            v.literal("space"),
        ),
        website: v.string(),
        location: v.string(),
    },
    handler: async (ctx, args) => {
        // restrict directory editing to the team
        await requireTeam(ctx);
        const { id, ...values } = args;
        if (
            !values.name.trim() ||
            values.name.length > 160 ||
            values.description.length > 5000 ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)
        )
            throw new Error("Enter a name, valid slug, and concise description.");
        values.website = normalizeUrl(values.website);

        // reject another organisation using the same URL
        const collision = await ctx.db
            .query("organisations")
            .withIndex("by_slug", (range) => range.eq("slug", values.slug))
            .unique();
        if (collision && collision._id !== id)
            throw new Error("An organisation already uses this URL.");

        // update the existing profile or create its first record
        if (id) {
            await ctx.db.patch(id, { ...values, updatedAt: Date.now() });

            return id;
        }

        return await ctx.db.insert("organisations", { ...values, updatedAt: Date.now() });
    },
});

/** Require management access to a company profile. */
export async function requireCompany(ctx: QueryCtx | MutationCtx, id: Id<"organisations">) {
    const viewer = await requireAccount(ctx);
    const organisation = await ctx.db.get(id);
    if (!organisation || (!viewer.isTeam && organisation.ownerMemberId !== viewer.memberId))
        throw new Error("You cannot manage this company.");

    return { viewer, organisation };
}

/** Create or edit a company used on approved jobs and sponsorships. */
export const upsertCompany = mutation({
    args: {
        id: v.optional(v.id("organisations")),
        ownerEmail: v.optional(v.string()),
        name: v.string(),
        slug: v.string(),
        website: v.string(),
        logoUrl: v.optional(v.string()),
        logoDarkUrl: v.optional(v.string()),
        mapLogoUrl: v.optional(v.string()),
        mapLogoDarkUrl: v.optional(v.string()),
        profileUrl: v.optional(v.string()),
        socials: v.optional(socialLinks),
        location: v.string(),
        description: v.string(),
    },
    handler: async (ctx, args) => {
        // require an account and ownership of any existing company
        const viewer = await requireAccount(ctx);
        if (args.id) await requireCompany(ctx, args.id);
        if (
            !args.name.trim() ||
            args.name.length > 160 ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug) ||
            args.description.length > 5000 ||
            !args.location.trim()
        )
            throw new Error("Enter a company name, URL slug, location and concise description.");

        // reject another organisation using the same URL
        const collision = await ctx.db
            .query("organisations")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .unique();
        if (collision && collision._id !== args.id)
            throw new Error(
                "This company URL is already taken. Ask the team to grant access to the existing company.",
            );

        // let the team assign an existing company to a verified signed in member
        let ownerMemberId: Id<"members"> | undefined;
        if (args.ownerEmail) {
            if (!viewer.isTeam) throw new Error("Team access is required to assign a company.");
            const address = await ctx.db
                .query("memberEmails")
                .withIndex("by_email", (q) => q.eq("email", normalizeEmail(args.ownerEmail!)))
                .unique();
            const ownerAccount = address
                ? await ctx.db
                      .query("accounts")
                      .withIndex("by_memberId", (q) => q.eq("memberId", address.memberId))
                      .unique()
                : null;
            if (!address?.verifiedAt || ownerAccount?.status !== "active")
                throw new Error("The company owner must sign in first with a verified email.");
            ownerMemberId = address.memberId;
        }

        // keep company identity stable while allowing its owner to maintain public details
        const { id, ownerEmail, ...fields } = args;
        const values = {
            ...fields,
            name: args.name.trim(),
            website: normalizeUrl(args.website),
            profileUrl: args.profileUrl?.trim() ? normalizeUrl(args.profileUrl.trim()) : undefined,
            socials: normalizeSocialLinks(args.socials),
            logoUrl: args.logoUrl ? normalizeImageUrl(args.logoUrl) : undefined,
            logoDarkUrl: args.logoDarkUrl ? normalizeImageUrl(args.logoDarkUrl) : undefined,
            mapLogoUrl: args.mapLogoUrl ? normalizeImageUrl(args.mapLogoUrl) : undefined,
            mapLogoDarkUrl: args.mapLogoDarkUrl
                ? normalizeImageUrl(args.mapLogoDarkUrl)
                : undefined,
            updatedAt: Date.now(),
        };

        // update the existing profile or create its first record
        if (id) {
            await ctx.db.patch(id, { ...values, ...(ownerMemberId ? { ownerMemberId } : {}) });

            return id;
        }

        return await ctx.db.insert("organisations", {
            ...values,
            ownerMemberId: ownerMemberId ?? viewer.memberId,
            kind: "company",
        });
    },
});

/** Add or update a public location without granting sponsorship privileges. */
export const saveLocation = mutation({
    args: {
        id: v.optional(v.id("organisationLocations")),
        organisationId: v.id("organisations"),
        name: v.string(),
        line1: v.string(),
        locality: v.string(),
        postalCode: v.optional(v.string()),
        countryCode: v.string(),
        latitude: v.number(),
        longitude: v.number(),
        isCurated: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { viewer } = await requireCompany(ctx, args.organisationId);
        if (args.isCurated !== undefined && !viewer.isTeam)
            throw new Error("Only the team can curate map locations.");
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
            throw new Error("Enter a valid address and coordinates.");
        const existing = args.id ? await ctx.db.get(args.id) : null;
        if (args.id && (!existing || existing.organisationId !== args.organisationId))
            throw new Error("Location not found.");
        const address = {
            line1: args.line1.trim(),
            locality: args.locality.trim(),
            postalCode: args.postalCode?.trim() || undefined,
            countryCode: args.countryCode,
            latitude: args.latitude,
            longitude: args.longitude,
            updatedAt: Date.now(),
        };

        // Copy shared addresses so an office edit cannot alter an event venue.
        if (existing) {
            const sharedVenue = await ctx.db
                .query("venues")
                .withIndex("by_addressId", (q) => q.eq("addressId", existing.addressId))
                .first();
            const sharedLocation = await ctx.db
                .query("organisationLocations")
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
            await ctx.db.patch(existing._id, {
                name: args.name.trim(),
                ...(args.isCurated !== undefined ? { isCurated: args.isCurated } : {}),
            });
            return existing._id;
        }
        const addressId = await ctx.db.insert("addresses", { ...address, createdAt: Date.now() });
        return await ctx.db.insert("organisationLocations", {
            organisationId: args.organisationId,
            addressId,
            name: args.name.trim(),
            isCurated: args.isCurated ?? false,
        });
    },
});

/** Attach a reviewed existing address to an organisation during catalogue imports. */
export const importLocation = internalMutation({
    args: {
        apply: v.boolean(),
        mapLogoUrl: v.optional(v.string()),
        slug: v.string(),
        eventSlug: v.string(),
        name: v.string(),
        isCurated: v.boolean(),
    },
    handler: async (ctx, args) => {
        const organisation = await ctx.db
            .query("organisations")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .unique();
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (q) => q.eq("slug", args.eventSlug))
            .unique();
        const venue = event?.venueId ? await ctx.db.get(event.venueId) : null;
        const address = venue ? await ctx.db.get(venue.addressId) : null;
        if (!organisation || address?.latitude === undefined || address.longitude === undefined)
            throw new Error("An organisation and geocoded address are required.");
        const mapLogoUrl = args.mapLogoUrl
            ? normalizeImageUrl(args.mapLogoUrl)
            : organisation.mapLogoUrl;
        const locations = await ctx.db
            .query("organisationLocations")
            .withIndex("by_organisation", (q) => q.eq("organisationId", organisation._id))
            .collect();
        const existing = locations.find((location) => location.addressId === address._id);
        const values = {
            organisationId: organisation._id,
            addressId: address._id,
            name: args.name,
            isCurated: args.isCurated,
        };
        const changed =
            !existing ||
            existing.name !== values.name ||
            existing.isCurated !== values.isCurated ||
            organisation.mapLogoUrl !== mapLogoUrl;

        // Preview the exact change before applying it to either deployment.
        if (args.apply && changed) {
            await ctx.db.patch(organisation._id, { mapLogoUrl, updatedAt: Date.now() });
            if (existing) await ctx.db.patch(existing._id, values);
            else await ctx.db.insert("organisationLocations", values);
        }

        return { applied: args.apply, changed, slug: organisation.slug, address: address.line1 };
    },
});

/** Read locations for an organisation the current account can manage. */
export const locations = query({
    args: { organisationId: v.id("organisations") },
    handler: async (ctx, args) => {
        await requireCompany(ctx, args.organisationId);
        const rows = await ctx.db
            .query("organisationLocations")
            .withIndex("by_organisation", (q) => q.eq("organisationId", args.organisationId))
            .collect();
        return await Promise.all(
            rows.map(async (row) => ({ ...row, address: await ctx.db.get(row.addressId) })),
        );
    },
});

/** Remove an organisation location from its profile and the map. */
export const removeLocation = mutation({
    args: { id: v.id("organisationLocations") },
    handler: async (ctx, args) => {
        const location = await ctx.db.get(args.id);
        if (!location) throw new Error("Location not found.");
        await requireCompany(ctx, location.organisationId);
        await ctx.db.delete(location._id);
    },
});
