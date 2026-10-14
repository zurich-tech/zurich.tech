import type { MapLocation } from "./queries";
import { matchesSearch } from "../search/search";
import { descendantTopics } from "../../convex/topics/hierarchy";

/** Read unique topic filters while preserving existing single-topic URLs. */
export function topicFilters(value: string | undefined): string[] {
    return [...new Set((value ?? "").split(",").filter(Boolean))];
}

/** Match any selected topic family, without widening unknown or loading filters. */
export function expandTopicFilters(
    selected: readonly string[],
    catalogue: readonly { slug: string; parent?: string }[] | undefined,
): Set<string> | undefined {
    if (!selected.length) return undefined;
    const result = new Set<string>();
    for (const slug of selected) {
        if (catalogue?.some((topic) => topic.slug === slug)) {
            for (const descendant of descendantTopics(slug, catalogue)) result.add(descendant);
        }
    }

    return result;
}

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
