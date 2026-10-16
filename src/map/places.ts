import type { MapLocation } from "./queries";

/** Resolve a linked organisation without selecting its neighbours at a shared address. */
export function organisationPlace(places: readonly MapLocation[], slug: string) {
    for (const place of places) {
        const organisation = place.organisations.find((entry) => entry.slug === slug);
        if (organisation) return { ...place, organisations: [organisation] };
    }

    return undefined;
}

/** Format an organisation count for visible and accessible labels. */
export function organisationCountLabel(count: number) {
    return `${count} organisation${count === 1 ? "" : "s"}`;
}

/** Format unique organisations in view against the filtered total. */
export function mapCount(visible: number, total: number) {
    const format = new Intl.NumberFormat("en-GB");

    return visible === total
        ? format.format(total)
        : `${format.format(visible)} / ${format.format(total)}`;
}

/** Choose up to three verified logos, putting sponsors and the address host first. */
export function stackOrganisations(place: MapLocation) {
    return place.organisations
        .filter((organisation) => organisation.mapLogoUrl ?? organisation.logoUrl)
        .sort(
            (left, right) =>
                Number(Boolean(right.isSponsor)) - Number(Boolean(left.isSponsor)) ||
                Number(right.recognition === "Host") - Number(left.recognition === "Host") ||
                left.name.localeCompare(right.name),
        )
        .slice(0, 3);
}

/** Count distinct organisations without counting their additional offices twice. */
export function countOrganisations(places: readonly MapLocation[]) {
    const ids = new Set<string>();
    for (const place of places) {
        for (const organisation of place.organisations) ids.add(organisation.id);
    }

    return ids.size;
}

/** Prefer a unique venue name, otherwise name two tenants and count the remainder. */
export function placeName(place: MapLocation) {
    const spaces = place.organisations.filter((organisation) => organisation.kind === "space");
    if (spaces.length === 1) return spaces[0].name;

    const names = [...place.organisations]
        .sort(
            (a, b) =>
                Number(Boolean(b.isSponsor)) - Number(Boolean(a.isSponsor)) ||
                a.name.localeCompare(b.name),
        )
        .map((organisation) => organisation.name);

    return [...names.slice(0, 2), ...(names.length > 2 ? [`+${names.length - 2}`] : [])].join(", ");
}

/** Keep complete address groups when at least one organisation matches the filters. */
export function matchingPlaces(locations: MapLocation[], matches: MapLocation[]) {
    const ids = new Set(matches.map((place) => place.id));

    return locations.filter((place) => ids.has(place.id));
}

/** Resolve selection against complete addresses, independently of directory filters. */
export function selectPlaces(locations: MapLocation[], ids: string[], organisation?: string) {
    return locations
        .filter((place) => ids.includes(place.id))
        .map((place) => ({
            ...place,
            organisations: place.organisations.filter(
                (person) => !organisation || person.id === organisation,
            ),
        }))
        .filter((place) => place.organisations.length > 0);
}
