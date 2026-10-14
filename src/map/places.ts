import type { MapLocation } from "./queries";

/** Name a shared address only when exactly one space is recorded there. */
export function placeName(place: MapLocation) {
    const spaces = place.organisations.filter((organisation) => organisation.kind === "space");

    return spaces.length === 1 ? spaces[0].name : "Shared address";
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
