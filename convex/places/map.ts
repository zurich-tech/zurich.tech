import { query } from "../_generated/server";

import { activeSponsors } from "../sponsorships/organisations";
import { readProfiles } from "../members/links";

/** Every public organisation location, with hosts and current sponsors highlighted. */
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
                    address?.latitude === undefined ||
                    address.longitude === undefined
                )
                    return null;
                const { socials } = await readProfiles(ctx, organisation._id);

                return {
                    id: organisation._id,
                    address: {
                        line1: address.line1,
                        postalCode: address.postalCode,
                        locality: address.locality,
                        countryCode: address.countryCode,
                    },
                    name: organisation.name,
                    kind: organisation.kind,
                    topics: organisation.topics ?? [],
                    location: location.name,
                    slug: organisation.slug,
                    website: organisation.website,
                    socials,
                    logoUrl: organisation.logoUrl,
                    logoDarkUrl: organisation.logoDarkUrl,
                    mapLogoUrl: organisation.mapLogoUrl,
                    mapLogoDarkUrl: organisation.mapLogoDarkUrl,
                    latitude: address.latitude,
                    longitude: address.longitude,
                    isSponsor: Boolean(sponsor),
                    recognition: sponsor
                        ? `${sponsor.tier[0].toUpperCase()}${sponsor.tier.slice(1)} sponsor`
                        : organisation.isHost
                          ? "Host"
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
