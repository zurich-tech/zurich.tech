import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";

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
