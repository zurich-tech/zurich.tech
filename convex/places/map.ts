import { query } from "../_generated/server";

import { activeSponsors } from "../sponsorships/organisations";
import { readCatalogue } from "../organisations/catalogue";

/** Every public organisation location, with hosts and current sponsors highlighted. */
export const map = query({
    args: {},
    handler: async (ctx) => {
        const [sponsors, catalogue] = await Promise.all([activeSponsors(ctx), readCatalogue(ctx)]);
        const organisations = new Map(catalogue.organisations.map((row) => [String(row._id), row]));
        const sponsorsByOrganisation = new Map(
            sponsors.map((row) => [String(row.organisationId), row]),
        );
        const markers = catalogue.locations.map((location) => {
            const sponsor = sponsorsByOrganisation.get(location.ownerId);
            const organisation = organisations.get(location.ownerId);
            const address = catalogue.addressesById.get(location.addressId);
            if (!organisation || address?.latitude === undefined || address.longitude === undefined)
                return null;
            const socials = catalogue.profilesByOwner.get(organisation._id)?.socials ?? {};

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
        });
        return markers.filter((marker) => marker !== null);
    },
});
