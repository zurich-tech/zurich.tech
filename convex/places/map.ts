import { query } from "../_generated/server";

import { activeSponsors } from "../sponsorships/organisations";

/** Public geographic locations with recognition derived from host status and current sponsorships. */
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
                const organisationId = ctx.db.normalizeId("organisations", location.ownerId);
                if (!organisationId) return null;
                const organisation = await ctx.db.get(organisationId);
                const address = await ctx.db.get(location.addressId);
                if (
                    !organisation ||
                    (!organisation.isHost && !sponsor && !location.isCurated) ||
                    address?.latitude === undefined ||
                    address.longitude === undefined
                )
                    return null;
                return {
                    id: organisation._id,
                    address: {
                        line1: address.line1,
                        postalCode: address.postalCode,
                        locality: address.locality,
                        countryCode: address.countryCode,
                    },
                    name: organisation.name,
                    location: location.name,
                    slug: organisation.slug,
                    logoUrl: organisation.logoUrl,
                    logoDarkUrl: organisation.logoDarkUrl,
                    mapLogoUrl: organisation.mapLogoUrl,
                    mapLogoDarkUrl: organisation.mapLogoDarkUrl,
                    latitude: address.latitude,
                    longitude: address.longitude,
                    recognition: organisation.isHost
                        ? "Host"
                        : sponsor
                          ? `${sponsor.tier[0].toUpperCase()}${sponsor.tier.slice(1)} sponsor`
                          : undefined,
                    headline: organisation.headline,
                    prominence:
                        organisation.isHost || sponsor?.tier === "gold"
                            ? ("large" as const)
                            : sponsor?.tier === "silver"
                              ? ("medium" as const)
                              : ("small" as const),
                };
            }),
        );
        return markers.filter((marker) => marker !== null);
    },
});
