import { publicQuery } from "../data/query";
import { api } from "../../convex/_generated/api";

/** Read the published feed from its single source of truth. */
export const getArticles = publicQuery(api.news.queries.list, "posts", () => ({}));

/** Read and subscribe to one published article. */
export const getArticle = publicQuery(api.news.queries.detail, "post", (slug: string) => ({
    slug,
}));
