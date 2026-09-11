import { query } from "../_generated/server";

import { activeSponsors } from "../sponsorships/organisations";

/** Public geographic locations with recognition derived from current sponsorships. */
export const map = query({
    args: {},
    handler: async (ctx) => {
        const sponsors = await activeSponsors(ctx);
        const locations = await ctx.db
            .query("locations")
            .filter((q) => q.eq(q.field("visibility"), "public"))
            .collect();
        const markers = await Promise.all(
            locations.map(async (location) => {
                const sponsor = sponsors.find((item) => item.organisationId === location.ownerId);
                if (!sponsor && !location.isCurated) return null;
                const organisationId = ctx.db.normalizeId("organisations", location.ownerId);
                if (!organisationId) return null;
                const organisation = await ctx.db.get(organisationId);
                const address = await ctx.db.get(location.addressId);
                if (
                    !organisation ||
                    address?.latitude === undefined ||
                    address.longitude === undefined
                )
                    return null;
                return {
                    id: location._id,
                    name: organisation.name,
                    location: location.name,
                    slug: organisation.slug,
                    logoUrl: organisation.logoUrl,
                    logoDarkUrl: organisation.logoDarkUrl,
                    mapLogoUrl: organisation.mapLogoUrl,
                    mapLogoDarkUrl: organisation.mapLogoDarkUrl,
                    latitude: address.latitude,
                    longitude: address.longitude,
                    tier: sponsor?.tier,
                };
            }),
        );
        return markers.filter((marker) => marker !== null);
    },
});
