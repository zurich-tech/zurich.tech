import type { MapLocation } from "./queries";
import { matchesSearch } from "../search/search";

/** Match category, topics and text against the same organisation at each shared address. */
export function filterLocations(
    locations: MapLocation[],
    category: string,
    terms: readonly string[],
    topics?: ReadonlySet<string>,
): MapLocation[] {
    return locations
        .map((place) => ({
            ...place,
            organisations: place.organisations.filter(
                (entry) =>
                    (category === "all" || entry.kind === category) &&
                    (topics === undefined || entry.topics?.some((topic) => topics.has(topic))) &&
                    matchesSearch(
                        [place.address, entry.name, entry.headline ?? ""].join(" "),
                        terms,
                    ),
            ),
        }))
        .filter((place) => place.organisations.length > 0);
}
