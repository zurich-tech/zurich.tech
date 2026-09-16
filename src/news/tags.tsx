import { FilterPills } from "../components/filter-pills";
import { createMemo } from "solid-js";
import type { Article } from "./model";

/** Link to the news archive filtered by each published tag. */
export function TagPills(props: { articles: Article[]; selected?: string }) {
    // list each published tag once, alphabetically
    const tags = createMemo(() => {
        const unique = new Map(
            props.articles.flatMap((article) =>
                articleTags(article).map((tag) => [tag.slug, tag] as const),
            ),
        );
        return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
    });

    return (
        <FilterPills
            class="news-tags"
            label="News tags"
            value={props.selected ?? ""}
            options={[
                { value: "", label: "All", href: "/news" },
                ...tags().map((tag) => ({
                    value: tag.slug,
                    label: tag.name,
                    href: `/news?tag=${encodeURIComponent(tag.slug)}`,
                })),
            ]}
        />
    );
}

/** Combine the announcement category and technology topics for display and filtering. */
export function articleTags(article: Article) {
    return [
        ...(article.category === "funding" ? [{ slug: "funding", name: "Funding" }] : []),
        ...article.topics,
    ];
}
