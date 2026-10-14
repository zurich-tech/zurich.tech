import { publicOrganisers } from "../events/organisers";
import { readProfiles } from "../members/links";

import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v } from "convex/values";

import { activeSponsors } from "../sponsorships/organisations";

/** Read published series without fetching the organisation directory. */
export const series = query({ args: {}, handler: readSeries });

/** Read one organisation without expanding unrelated directory entries. */
export const detail = query({
    args: { slug: v.string() },
    handler: async (ctx, { slug }) => {
        const [organisation, sponsors] = await Promise.all([
            ctx.db
                .query("organisations")
                .withIndex("by_slug", (q) => q.eq("slug", slug))
                .unique(),
            activeSponsors(ctx),
        ]);
        if (!organisation) return null;

        return readOrganisation(
            ctx,
            organisation,
            sponsors.find((sponsor) => sponsor.organisationId === organisation._id),
        );
    },
});

/** Expand public organisers consistently for series and directory views. */
async function readSeries(ctx: QueryCtx) {
    const items = await ctx.db
        .query("series")
        .filter((q) => q.neq(q.field("status"), "proposed"))
        .collect();

    return Promise.all(
        items.map(async (item) => ({ ...item, ...(await publicOrganisers(ctx, item)) })),
    );
}

/** Read the public series and organisation directory. */
export const directory = query({
    args: {},
    handler: async (ctx) => {
        const [sponsors, organisations, series] = await Promise.all([
            activeSponsors(ctx),
            ctx.db.query("organisations").collect(),
            readSeries(ctx),
        ]);

        return {
            series,
            organisations: await Promise.all(
                organisations.map((organisation) =>
                    readOrganisation(
                        ctx,
                        organisation,
                        sponsors.find((sponsor) => sponsor.organisationId === organisation._id),
                    ),
                ),
            ),
        };
    },
});

/** Expand the same public profile and visible locations for list and detail reads. */
async function readOrganisation(
    ctx: QueryCtx,
    organisation: Doc<"organisations">,
    sponsor?: Awaited<ReturnType<typeof activeSponsors>>[number],
) {
    const [profiles, locations] = await Promise.all([
        readProfiles(ctx, organisation._id),
        ctx.db
            .query("locations")
            .withIndex("by_owner", (q) => q.eq("ownerId", organisation._id))
            .filter((q) => q.eq(q.field("visibility"), "public"))
            .collect(),
    ]);

    return {
        _id: organisation._id,
        slug: organisation.slug,
        name: organisation.name,
        headline: organisation.headline,
        kind: organisation.kind,
        topics: organisation.topics ?? [],
        description: organisation.description,
        location: organisation.location,
        website: organisation.website,
        logoUrl: organisation.logoUrl,
        logoDarkUrl: organisation.logoDarkUrl,
        mapLogoUrl: organisation.mapLogoUrl,
        mapLogoDarkUrl: organisation.mapLogoDarkUrl,
        ...profiles,
        isHost: Boolean(organisation.isHost),
        isSponsor: Boolean(sponsor),
        sponsorTier: sponsor?.tier,
        locations: await Promise.all(
            locations.map(async (location) => ({
                ...location,
                address: await ctx.db.get(location.addressId),
            })),
        ),
    };
}
