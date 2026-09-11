import { For, createMemo } from "solid-js";
import { Card } from "../components/card";
import type { Article } from "./queries";

/** Browse the canonical tags attached to published articles. */
export function Tags(props: { articles: Article[]; selected?: string }) {
    // count each article once under each of its explicit tags
    const tags = createMemo(() => {
        const counts = new Map<string, { slug: string; name: string; count: number }>();
        for (const article of props.articles) {
            for (const tag of article.tags) {
                const existing = counts.get(tag.slug);
                counts.set(tag.slug, { ...tag, count: (existing?.count ?? 0) + 1 });
            }
        }

        return [...counts.values()].sort((left, right) => left.name.localeCompare(right.name));
    });

    return (
        <Card title="Tags">
            <nav class="news-tags filter-pills" aria-label="News tags">
                <a
                    href="/news"
                    classList={{ selected: !props.selected }}
                    aria-current={!props.selected ? "page" : undefined}
                >
                    All <span>{props.articles.length}</span>
                </a>
                <For each={tags()}>
                    {(tag) => (
                        <a
                            href={`/news?tag=${encodeURIComponent(tag.slug)}`}
                            classList={{ selected: props.selected === tag.slug }}
                            aria-current={props.selected === tag.slug ? "page" : undefined}
                        >
                            {tag.name} <span>{tag.count}</span>
                        </a>
                    )}
                </For>
            </nav>
        </Card>
    );
}
