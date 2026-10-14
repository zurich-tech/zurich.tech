import { descendantTopics } from "../../convex/topics/hierarchy";

/** Replace overlapping ancestors or descendants with the explicitly selected subject. */
export function selectSpecificTopic(
    selected: string[],
    slug: string,
    topics: readonly { slug: string; parent?: string }[],
) {
    const descendants = descendantTopics(slug, topics);
    const ancestors = new Set(
        selected.filter((value) => descendantTopics(value, topics).has(slug)),
    );

    return [...selected.filter((value) => !descendants.has(value) && !ancestors.has(value)), slug];
}
