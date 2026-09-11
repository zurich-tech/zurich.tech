import { type Article } from "./queries";
import { For, Show, createMemo, createSignal } from "solid-js";

import { matchesSearch, searchTerms } from "../search/search";
import { Entry } from "../events/entry";
import { Highlight } from "../components/highlight";
import { Card } from "../components/card";
import { TableToolbar } from "../components/toolbar";

/** Article list properties. */
type ArticleListProps = {
    /** The articles to show. */
    articles: Article[];
    /** Use the collection heading as the page title. */
    isPage?: boolean;
    /** Show only titles and subtitles in the homepage sidebar. */
    isCompact?: boolean;
    /** Whether to show article search. */
    isSearchable?: boolean;
    /** Filter by an exact canonical tag slug. */
    tag?: string;
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
        return props.articles.filter(
            (article) =>
                (!props.tag || article.tags.some((tag) => tag.slug === props.tag)) &&
                matchesSearch(articleText(article), terms()),
        );
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
        <Card
            heading={props.isPage ? "h1" : "h2"}
            class={props.isCompact ? "news-overview" : undefined}
            meta={props.isCompact ? undefined : count()}
            title={props.isPage || props.isCompact ? "News" : "Articles"}
            titleHref={props.titleHref ?? (props.isPage ? undefined : "/news")}
            toolbar={
                props.isSearchable === true ? (
                    <TableToolbar onSearch={setQuery} placeholder="Search articles" />
                ) : undefined
            }
        >
            {/* articles */}
            <Show
                when={articles().length > 0}
                fallback={<p class="text-soft">No articles match these filters.</p>}
            >
                <div class="news-list">
                    <For each={articles()}>
                        {(article) => (
                            <Entry
                                class="news-row"
                                date={article.date}
                                datePlacement="below"
                                href={`/news/${article.slug}`}
                                description={
                                    <Highlight text={article.description} terms={terms()} />
                                }
                                meta={
                                    props.isCompact
                                        ? undefined
                                        : article.authors.map((author) => author.name).join(", ")
                                }
                                title={<Highlight text={article.title} terms={terms()} />}
                            />
                        )}
                    </For>
                </div>
            </Show>
        </Card>
    );
}

/** Build searchable article text. */
function articleText(article: Article) {
    return [
        article.title,
        article.description,
        ...article.tags.map((tag) => tag.name),
        ...article.authors.map((author) => author.name),
    ].join(" ");
}
