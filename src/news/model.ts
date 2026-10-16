import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { isNewsTag, newsTags } from "../../convex/news/tags";

/** One published news record, shared by lists and article pages. */
export type Article = FunctionReturnType<typeof api.news.queries.list>[number];

/** Published article metadata without its full body. */
export type ArticlePreview = FunctionReturnType<typeof api.news.queries.headlines>[number];

/** Preserve paragraph breaks while joining source text wrapped across lines. */
export function articleParagraphs(description: string): string[] {
    return description
        .trim()
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
        .filter(Boolean);
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
