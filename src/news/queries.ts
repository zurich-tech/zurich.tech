import { query } from "@solidjs/router";
import { articles } from "./articles.generated";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { publicClient } from "../auth/convex";

/** Common feed shape for authored articles, short posts and external links. */
export type Article = {
    id?: Id<"posts">;
    slug: string;
    title: string;
    description: string;
    body: string;
    date: number;
    kind?: "post" | "link";
    url?: string;
    image?: string;
    authors: { name: string; url?: string }[];
    tags: { name: string; slug: string }[];
    organisations?: { name: string; slug: string }[];
};

/** Merge published records with the authored archive in newest-first order. */
export const getArticles = query(async (): Promise<Article[]> => {
    const posts = await publicClient().query(api.news.queries.list, {});
    return [...articles, ...posts].sort((a, b) => b.date - a.date);
}, "articles");

/** Read a published entry by its permanent slug. */
export const getArticle = query(
    async (slug: string) => (await getArticles()).find((post) => post.slug === slug) ?? null,
    "article",
);
