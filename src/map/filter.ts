import type { MapLocation } from "./queries";
import { fold, matchesSearch } from "../search/search";
import { descendantTopics } from "../../convex/topics/hierarchy";

/** Retain name highlight subscriptions when only other searchable fields change. */
export function nameTerms(
    name: string,
    terms: readonly string[],
    previous: readonly string[] = [],
): readonly string[] {
    const normalized = fold(name);
    const matching = terms.filter((term) => normalized.includes(term));

    return matching.length === previous.length &&
        matching.every((term, index) => term === previous[index])
        ? previous
        : matching;
}

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
    // preserve the original collection when nothing narrows it
    if (category === "all" && terms.length === 0 && topics === undefined) return locations;

    return locations
        .map((place) => {
            const organisations = place.organisations.filter(
                (entry) =>
                    (category === "all" || entry.kind === category) &&
                    (topics === undefined || entry.topics?.some((topic) => topics.has(topic))) &&
                    matchesSearch(
                        [place.address, entry.name, entry.headline ?? ""].join(" "),
                        terms,
                    ),
            );

            return organisations.length === place.organisations.length
                ? place
                : { ...place, organisations };
        })
        .filter((place) => place.organisations.length > 0);
}
