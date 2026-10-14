/** Include a topic and every descendant when matching a broader subject. */
export function descendantTopics(
    slug: string,
    topics: readonly { slug: string; parent?: string }[],
): Set<string> {
    // require a known root and index children once for a linear traversal
    if (!topics.some((topic) => topic.slug === slug)) throw new Error(`Unknown topic: ${slug}.`);
    const children = new Map<string, string[]>();
    for (const topic of topics) {
        if (topic.parent === undefined) continue;
        const siblings = children.get(topic.parent) ?? [];
        siblings.push(topic.slug);
        children.set(topic.parent, siblings);
    }

    // visit each descendant once and reject cycles instead of looping indefinitely
    const descendants = new Set([slug]);
    for (const parent of descendants) {
        for (const child of children.get(parent) ?? []) {
            if (descendants.has(child))
                throw new Error(`Topic hierarchy contains a cycle: ${child}.`);
            descendants.add(child);
        }
    }

    return descendants;
}
