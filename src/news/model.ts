import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

/** One published news record, shared by lists and article pages. */
export type Article = FunctionReturnType<typeof api.news.queries.list>[number];

/** Published article metadata without its full body. */
export type ArticlePreview = FunctionReturnType<typeof api.news.queries.headlines>[number];

/** Resolve topic identities to the current public labels. */
export function articleTopics(
    slugs: string[],
    catalogue: { name: string; slug: string }[],
): { name: string; slug: string }[] {
    return slugs.map((slug) => {
        const topic = catalogue.find((topic) => topic.slug === slug);
        if (!topic) throw new Error(`Unknown article topic: ${slug}.`);
        return { slug, name: topic.name };
    });
}
