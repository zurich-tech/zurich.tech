import { For, createMemo } from "solid-js";
import { Card } from "../components/card";
import type { Article } from "./queries";

/** Browse the canonical tags attached to published articles. */
export function Tags(props: { articles: Article[]; selected?: string }) {
    return (
        <Card title="Topics">
            <TagPills {...props} />
        </Card>
    );
}

/** Link to the news archive filtered by each published tag. */
export function TagPills(props: { articles: Article[]; selected?: string }) {
    // list each published tag once, alphabetically
    const tags = createMemo(() => {
        const unique = new Map(
            props.articles.flatMap((article) =>
                article.topics.map((tag) => [tag.slug, tag] as const),
            ),
        );
        return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
    });

    return (
        <nav class="news-tags filter-pills" aria-label="News tags">
            <a
                href="/news"
                classList={{ selected: !props.selected }}
                aria-current={!props.selected ? "page" : undefined}
            >
                All
            </a>
            <For each={tags()}>
                {(tag) => (
                    <a
                        href={`/news?tag=${encodeURIComponent(tag.slug)}`}
                        classList={{ selected: props.selected === tag.slug }}
                        aria-current={props.selected === tag.slug ? "page" : undefined}
                    >
                        {tag.name}
                    </a>
                )}
            </For>
        </nav>
    );
}
