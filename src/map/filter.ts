import type { MapLocation } from "./queries";
import { fold } from "../search/search";
import { descendantTopics } from "../../convex/topics/hierarchy";

/** Retain only the latest searchable text for each live organisation object. */
const searchIndex = new WeakMap<
    MapLocation["organisations"][number],
    {
        /** Address used to build this text, including shared-address changes. */
        address: string;
        /** Original organisation name. */
        name: string;
        /** Original headline, with absent values represented as empty text. */
        headline: string;
        /** Folded address, name and headline with their original separators. */
        normalized: string;
    }
>();

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

/** Count unique organisations per topic family in an already-filtered collection. */
export function countTopics(
    locations: readonly MapLocation[],
    catalogue: readonly { slug: string; parent?: string }[],
): Record<string, number> {
    // index known ancestors once, excluding missing parents and rejecting cycles
    const parents = new Map(catalogue.map((topic) => [topic.slug, topic.parent]));
    const ancestors = new Map<string, Set<string>>();
    const organisations = new Map<string, Set<string>>();
    for (const { slug } of catalogue) {
        const family = new Set<string>();
        let current: string | undefined = slug;
        while (current !== undefined && parents.has(current)) {
            if (family.has(current))
                throw new Error(`Topic hierarchy contains a cycle: ${current}.`);
            family.add(current);
            current = parents.get(current);
        }
        ancestors.set(slug, family);
        organisations.set(slug, new Set());
    }

    // propagate each matching organisation's topics without recounting other offices or siblings
    for (const place of locations) {
        for (const organisation of place.organisations) {
            for (const topic of organisation.topics ?? []) {
                for (const ancestor of ancestors.get(topic) ?? []) {
                    organisations.get(ancestor)!.add(organisation.id);
                }
            }
        }
    }

    return Object.fromEntries([...organisations].map(([slug, ids]) => [slug, ids.size]));
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
                    (terms.length === 0 || matchesIndexedSearch(place.address, entry, terms)),
            );

            return organisations.length === place.organisations.length
                ? place
                : { ...place, organisations };
        })
        .filter((place) => place.organisations.length > 0);
}

/** Reuse folded text while checking all searchable fields for in-place updates. */
function matchesIndexedSearch(
    address: string,
    entry: MapLocation["organisations"][number],
    terms: readonly string[],
) {
    const headline = entry.headline ?? "";
    let indexed = searchIndex.get(entry);

    // preserve whole-string folding and invalidate changed fields without relying on ids
    if (
        !indexed ||
        indexed.address !== address ||
        indexed.name !== entry.name ||
        indexed.headline !== headline
    ) {
        indexed = {
            address,
            name: entry.name,
            headline,
            normalized: fold([address, entry.name, headline].join(" ")),
        };
        searchIndex.set(entry, indexed);
    }

    return terms.every((term) => indexed.normalized.includes(term));
}
