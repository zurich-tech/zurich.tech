import { For, Show, createMemo, createSignal } from "solid-js";

import type { Article } from "../data/public";
import { matchesSearch, searchTerms } from "../search";
import { formatDate } from "./calendar";
import { Highlight } from "./highlight";
import { DirectoryList, DirectoryRow } from "./list";
import { Section } from "./page";
import { TableToolbar } from "./toolbar";

/** Article list properties. */
type ArticleListProps = {
    /** The articles to show. */
    articles: Article[];
    /** Whether to show article search. */
    isSearchable?: boolean;
    /** The maximum visible article count. */
    limit?: number;
    /** The news heading destination. */
    titleHref?: string;
};

/** Render dated articles with optional search. */
export function ArticleList(props: ArticleListProps) {
    const [query, setQuery] = createSignal("");
    const terms = createMemo(() => searchTerms(query()));

    // filter all visible article fields
    const matches = createMemo(() => {
        if (terms().length === 0) {
            return props.articles;
        }

        return props.articles.filter((article) => matchesSearch(articleText(article), terms()));
    });

    // apply the homepage limit after filtering
    const articles = createMemo(() => matches().slice(0, props.limit));
    const count = () => {
        if (props.isSearchable === true && matches().length !== props.articles.length) {
            return `${matches().length} / ${props.articles.length}`;
        }

        return `${props.articles.length}`;
    };

    return (
        <Section
            href={props.titleHref}
            meta={count()}
            title="news"
            toolbar={
                props.isSearchable === true ? (
                    <TableToolbar onSearch={setQuery} placeholder="search news..." />
                ) : undefined
            }
        >
            {/* articles */}
            <Show when={articles().length > 0} fallback={<p class="text-soft">no articles</p>}>
                <DirectoryList>
                    <For each={articles()}>
                        {(article) => (
                            <DirectoryRow
                                eyebrow={articleDate(article)}
                                href={`/news/${article.slug}`}
                                summary={<Highlight text={article.description} terms={terms()} />}
                                tags={article.tags}
                                terms={terms()}
                                title={<Highlight text={article.title} terms={terms()} />}
                            />
                        )}
                    </For>
                </DirectoryList>
            </Show>
        </Section>
    );
}

/** Build searchable article text. */
function articleText(article: Article) {
    return [article.title, article.description, ...article.tags].join(" ");
}

/** Format one article publication date. */
function articleDate(article: Article) {
    if (article.date === undefined) {
        return undefined;
    }

    return formatDate(article.date);
}
