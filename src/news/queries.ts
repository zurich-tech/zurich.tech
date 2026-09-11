import { query } from "@solidjs/router";

import { articles } from "./articles.generated";

/** One article compiled from authored Markdown. */
export type Article = (typeof articles)[number];

/** Read published news articles. */
export const getArticles = query(async () => articles, "articles");

/** Read one published news article. */
export const getArticle = query(
    async (slug: string) => articles.find((article) => article.slug === slug) ?? null,
    "article",
);
