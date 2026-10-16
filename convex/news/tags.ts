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
