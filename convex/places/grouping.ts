import type { OrganisationKind } from "../organisations/kinds";
import type { readProfiles } from "../members/links";

/** Public organisation identity at a geographic address. */
export interface LocatedOrganisation {
    id: string;
    name: string;
    kind: OrganisationKind;
    slug: string;
    /** The organisation's public website. */
    website?: string;
    /** Public social profiles shared by every location of the organisation. */
    socials?: Awaited<ReturnType<typeof readProfiles>>["socials"];
    location: string;
    logoUrl?: string;
    logoDarkUrl?: string;
    mapLogoUrl?: string;
    mapLogoDarkUrl?: string;
    headline?: string;
    recognition?: string;
    /** Whether the organisation has an active sponsorship. */
    isSponsor?: boolean;
    prominence: "large" | "medium" | "small";
    latitude: number;
    longitude: number;
    address: { line1: string; postalCode?: string; locality: string; countryCode: string };
}

/** Merge shared street addresses even when office records use separate address documents. */
export function groupLocations(entries: LocatedOrganisation[]) {
    const groups = new Map<
        string,
        {
            id: string;
            address: string;
            latitude: number;
            longitude: number;
            organisations: Omit<LocatedOrganisation, "latitude" | "longitude" | "address">[];
        }
    >();
    for (const { address, latitude, longitude, ...organisation } of entries) {
        const id = JSON.stringify(
            [address.countryCode, address.postalCode ?? "", address.locality, address.line1].map(
                (part) =>
                    part
                        .normalize("NFKD")
                        .replace(/\p{M}/gu, "")
                        .trim()
                        .replace(/\s+/g, " ")
                        .toLowerCase(),
            ),
        );
        let group = groups.get(id);
        if (!group) {
            group = {
                id,
                address: [
                    address.line1,
                    [address.postalCode, address.locality].filter(Boolean).join(" "),
                ].join(", "),
                latitude,
                longitude,
                organisations: [],
            };
            groups.set(id, group);
        }
        if (!group.organisations.some((entry) => entry.id === organisation.id))
            group.organisations.push(organisation);
    }
    const rank = { large: 0, medium: 1, small: 2 };
    for (const group of groups.values())
        group.organisations.sort(
            (a, b) => rank[a.prominence] - rank[b.prominence] || a.name.localeCompare(b.name),
        );
    return [...groups.values()].sort((a, b) => a.address.localeCompare(b.address));
}
