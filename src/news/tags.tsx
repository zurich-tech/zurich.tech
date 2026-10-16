import { FilterPills } from "../components/filter-pills";
import { createMemo } from "solid-js";
import { FacetList } from "../components/facets";
import type { ArticlePreview } from "./model";

/** Link to the news archive filtered by each published tag. */
export function TagPills(props: { articles: ArticlePreview[]; selected?: string }) {
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

/** List every tag with its article count for the news sidebar, most used first. */
export function TopicList(props: { articles: ArticlePreview[]; selected?: string }) {
    // count each tag once per article
    const tags = createMemo(() => {
        const counts = new Map<string, { slug: string; name: string; count: number }>();
        for (const article of props.articles)
            for (const tag of articleTags(article)) {
                const current = counts.get(tag.slug) ?? { ...tag, count: 0 };
                counts.set(tag.slug, { ...current, count: current.count + 1 });
            }
        return [...counts.values()].sort(
            (left, right) => right.count - left.count || left.name.localeCompare(right.name),
        );
    });

    return (
        <FacetList
            title="Tags"
            facets={[
                {
                    label: "All news",
                    href: "/news",
                    meta: String(props.articles.length),
                    isSelected: !props.selected,
                },
                ...tags().map((tag) => ({
                    label: tag.name,
                    href: `/news?tag=${encodeURIComponent(tag.slug)}`,
                    meta: String(tag.count),
                    isSelected: props.selected === tag.slug,
                })),
            ]}
        />
    );
}

/** Read the unified tags used for display and filtering. */
export function articleTags(article: ArticlePreview) {
    return article.topics;
}
