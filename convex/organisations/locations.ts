import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { normalizeUrl } from "../members/urls";

/** Reviewed coordinates in WGS84 decimal degrees. */
const coordinates = v.object({
    /** Latitude in decimal degrees. */ latitude: v.number(),
    /** Longitude in decimal degrees. */ longitude: v.number(),
});

/** Correct reviewed public address coordinates without moving or relabelling organisations. */
export const correctCoordinates = internalMutation({
    args: {
        /** Validate only unless explicitly applying the reviewed batch. */ apply: v.boolean(),
        /** Distinct existing addresses and their complete expected public references. */
        corrections: v.array(
            v.object({
                /** Existing address to correct. */ addressId: v.id("addresses"),
                /** Exact reviewed address fields, including absent optional fields. */
                expectedAddress: v.object({
                    /** Existing address label. */ label: v.optional(v.string()),
                    /** Existing street and house number. */ line1: v.string(),
                    /** Existing secondary address line. */ line2: v.optional(v.string()),
                    /** Existing postal code. */ postalCode: v.optional(v.string()),
                    /** Existing locality. */ locality: v.string(),
                    /** Existing country code. */ countryCode: v.literal("CH"),
                    /** Existing region. */ region: v.optional(v.string()),
                }),
                /** Exact coordinates observed during review. */ expectedCoordinates: coordinates,
                /** Independently verified address point. */ coordinates,
                /** Exact federal building-address feature supporting the correction. */
                federalSourceUrl: v.string(),
                /** Reviewed primary corporate publications supporting this address. */
                corporateSourceUrls: v.array(v.string()),
                /** Every location currently referencing this address. */
                references: v.array(
                    v.object({
                        /** Existing public location. */ locationId: v.id("locations"),
                        /** Exact location label to preserve. */ locationName: v.string(),
                        /** Existing organisation owning this location. */
                        organisationId: v.id("organisations"),
                        /** Exact reviewed organisation slug. */ slug: v.string(),
                        /** Exact reviewed organisation website. */ website: v.string(),
                    }),
                ),
            }),
        ),
    },
    handler: async (ctx, { apply, corrections }) => {
        // bound the transaction and reject repeated targets before any database writes
        if (!corrections.length || corrections.length > 100)
            throw new Error("Correct between 1 and 100 reviewed addresses.");
        const addressIds = new Set(corrections.map((row) => row.addressId));
        if (addressIds.size !== corrections.length)
            throw new Error("Reviewed addresses must be distinct.");
        let locationCount = 0;

        // validate evidence, expected state and all address consumers in both modes
        for (const row of corrections) {
            if (
                !isSwissCoordinates(row.expectedCoordinates) ||
                !isSwissCoordinates(row.coordinates)
            )
                throw new Error(`Invalid Swiss coordinates: ${row.addressId}.`);
            if (
                row.coordinates.latitude === row.expectedCoordinates.latitude &&
                row.coordinates.longitude === row.expectedCoordinates.longitude
            )
                throw new Error(`Coordinates are unchanged: ${row.addressId}.`);
            const federal = new URL(normalizeUrl(row.federalSourceUrl));
            if (
                federal.protocol !== "https:" ||
                federal.host !== "api3.geo.admin.ch" ||
                federal.username ||
                federal.password ||
                !/^\/rest\/services\/ech\/MapServer\/ch\.swisstopo\.amtliches-gebaeudeadressverzeichnis\/\d+$/.test(
                    federal.pathname,
                )
            )
                throw new Error(`A federal building-address source is required: ${row.addressId}.`);
            if (!row.corporateSourceUrls.length || row.corporateSourceUrls.length > 10)
                throw new Error(
                    `Provide between 1 and 10 primary corporate URLs: ${row.addressId}.`,
                );
            for (const source of row.corporateSourceUrls) {
                const url = new URL(normalizeUrl(source));
                if (url.username || url.password)
                    throw new Error(`Source URLs must not contain credentials: ${row.addressId}.`);
            }

            // require the full reviewed address text and coordinates to remain exact
            const address = await ctx.db.get(row.addressId);
            if (
                !address ||
                address.latitude !== row.expectedCoordinates.latitude ||
                address.longitude !== row.expectedCoordinates.longitude ||
                address.countryCode !== row.expectedAddress.countryCode ||
                address.line1 !== row.expectedAddress.line1 ||
                address.line2 !== row.expectedAddress.line2 ||
                address.label !== row.expectedAddress.label ||
                address.postalCode !== row.expectedAddress.postalCode ||
                address.locality !== row.expectedAddress.locality ||
                address.region !== row.expectedAddress.region
            )
                throw new Error(`Reviewed address changed or is missing: ${row.addressId}.`);

            // reject venues rather than mutate a shared address or create a replacement
            const venue = await ctx.db
                .query("venues")
                .withIndex("by_address", (q) => q.eq("addressId", row.addressId))
                .first();
            if (venue) throw new Error(`Address is shared with a venue: ${row.addressId}.`);
            if (!row.references.length || row.references.length > 100)
                throw new Error(`Provide between 1 and 100 public references: ${row.addressId}.`);
            const references = new Map(
                row.references.map((reference) => [reference.locationId, reference]),
            );
            if (references.size !== row.references.length)
                throw new Error(`Reviewed references must be distinct: ${row.addressId}.`);

            // read one extra consumer to detect additions without accepting a truncated reference set
            const locations = await ctx.db
                .query("locations")
                .withIndex("by_address", (q) => q.eq("addressId", row.addressId))
                .take(references.size + 1);
            if (locations.length !== references.size)
                throw new Error(`Address references changed: ${row.addressId}.`);
            for (const location of locations) {
                const reference = references.get(location._id);
                if (
                    !reference ||
                    location.visibility !== "public" ||
                    location.ownerId !== reference.organisationId ||
                    location.name !== reference.locationName
                )
                    throw new Error(`Public organisation reference changed: ${row.addressId}.`);
                const organisation = await ctx.db.get(reference.organisationId);
                if (
                    !organisation ||
                    organisation.slug !== reference.slug ||
                    organisation.website !== reference.website
                )
                    throw new Error(`Reviewed organisation changed: ${row.addressId}.`);
            }
            locationCount += locations.length;
        }

        // apply only coordinate fields after every precondition passes in this transaction
        if (apply) {
            const updatedAt = Date.now();
            for (const row of corrections)
                await ctx.db.patch(row.addressId, { ...row.coordinates, updatedAt });
        }

        return {
            applied: apply,
            count: corrections.length,
            locationCount,
            addressIds: [...addressIds],
        };
    },
});

/** Require finite coordinates inside the importer's Swiss geographic bounding box. */
function isSwissCoordinates(point: { latitude: number; longitude: number }) {
    return (
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude) &&
        point.latitude >= 45.8 &&
        point.latitude <= 47.9 &&
        point.longitude >= 5.9 &&
        point.longitude <= 10.6
    );
}
