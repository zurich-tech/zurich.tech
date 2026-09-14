import { publicOrganisers } from "../events/organisers";
import { readProfiles } from "../members/links";

import { query } from "../_generated/server";

import { activeSponsors } from "../sponsorships/organisations";

/** Read the public series and organisation directory. */
export const directory = query({
    args: {},
    handler: async (ctx) => {
        const sponsors = await activeSponsors(ctx);
        const sponsored = new Set(sponsors.map((sponsor) => sponsor.organisationId));
        const organisations = await ctx.db.query("organisations").collect();
        const series = await ctx.db
            .query("series")
            .filter((q) => q.neq(q.field("status"), "proposed"))
            .collect();

        return {
            series: await Promise.all(
                series.map(async (item) => ({
                    ...item,
                    ...(await publicOrganisers(ctx, item)),
                })),
            ),
            organisations: await Promise.all(
                organisations.map(async (organisation) => ({
                    _id: organisation._id,
                    slug: organisation.slug,
                    name: organisation.name,
                    headline: organisation.headline,
                    kind: organisation.kind,
                    description: organisation.description,
                    location: organisation.location,
                    website: organisation.website,
                    logoUrl: organisation.logoUrl,
                    logoDarkUrl: organisation.logoDarkUrl,
                    mapLogoUrl: organisation.mapLogoUrl,
                    mapLogoDarkUrl: organisation.mapLogoDarkUrl,
                    ...(await readProfiles(ctx, organisation._id)),
                    isSponsor: sponsored.has(organisation._id),
                    sponsorTier: sponsors.find(
                        (sponsor) => sponsor.organisationId === organisation._id,
                    )?.tier,
                    locations: await Promise.all(
                        (
                            await ctx.db
                                .query("locations")
                                .withIndex("by_owner", (q) => q.eq("ownerId", organisation._id))
                                .filter((q) => q.eq(q.field("visibility"), "public"))
                                .collect()
                        ).map(async (location) => ({
                            ...location,
                            address: await ctx.db.get(location.addressId),
                        })),
                    ),
                })),
            ),
        };
    },
});
