/** News labels available alongside the technology topic catalogue. */
export const newsTags = {
    funding: "Funding",
    research: "Research",
    acquisitions: "Acquisitions",
} as const;

/** Recognise labels that belong to news rather than member interests. */
export function isNewsTag(value: string): value is keyof typeof newsTags {
    return Object.hasOwn(newsTags, value);
}

/** Include the funding label stored separately in older articles. */
export function tagSlugs(content: { topics: string[]; category?: "funding" }) {
    return [...new Set([...(content.category ? [content.category] : []), ...content.topics])];
}

/** Resolve topic identities to the current public labels. */
export function articleTopics(
    slugs: string[],
    catalogue: { name: string; slug: string }[],
): { name: string; slug: string }[] {
    return slugs.map((slug) => {
        if (isNewsTag(slug)) return { slug, name: newsTags[slug] };
        const topic = catalogue.find((topic) => topic.slug === slug);
        if (!topic) throw new Error(`Unknown article topic: ${slug}.`);

        return { slug, name: topic.name };
    });
}
