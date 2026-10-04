import { useSearch } from "../search/local";
import "./article.css";
import { NewsActions } from "./actions";
import { EditLink } from "../auth/edit";
import { articleTags, TagPills } from "./tags";
import { type Article, type ArticlePreview } from "./model";
import { For, Show, createEffect, createMemo, createSignal, on } from "solid-js";
import { pageSize } from "../app/site";
import "../events/programme.css";

import { matchesSearch, searchTerms, searchExcerpt } from "../search/search";
import { Entry } from "../events/entry";
import { Highlight } from "../components/highlight";
import { Card } from "../components/card";
import { TableToolbar } from "../components/toolbar";

/** Article list properties. */
type ArticleListProps = {
    /** The articles to show. */
    articles: (Article | ArticlePreview)[];
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
    const { query, setQuery } = useSearch();
    const terms = createMemo(() => searchTerms(query()));

    // filter all visible article fields
    const matches = createMemo(() => {
        return props.articles.filter(
            (article) =>
                (!props.tag || articleTags(article).some((tag) => tag.slug === props.tag)) &&
                matchesSearch(articleText(article), terms()),
        );
    });

    // reveal the full archive in pages, restarting whenever the filters change
    const [visibleCount, setVisibleCount] = createSignal(pageSize * 2);
    createEffect(
        on([terms, () => props.tag], () => setVisibleCount(pageSize * 2), { defer: true }),
    );

    // apply the homepage limit or the current page after filtering
    const articles = createMemo(() => matches().slice(0, props.limit ?? visibleCount()));

    return (
        <Card
            heading={props.isPage ? "h1" : "h2"}
            class={props.isCompact ? "news-card news-overview" : "news-card"}
            title={props.isPage || props.isCompact ? "News" : "Articles"}
            toolbar={<NewsActions isCompact={props.isCompact} />}
            titleHref={props.titleHref ?? (props.isPage ? undefined : "/news")}
        >
            <Show when={!props.isSearchable}>
                <div class="news-filters">
                    <TagPills articles={props.articles} selected={props.tag} />
                </div>
            </Show>
            <Show when={props.isSearchable}>
                <TableToolbar onSearch={setQuery} value={query()} placeholder="Search news…" />
            </Show>
            {/* articles */}
            <Show
                when={articles().length > 0}
                fallback={<p class="text-soft">No news matches these filters.</p>}
            >
                <div class="news-list">
                    <For each={articles()}>
                        {(article) => (
                            <Entry
                                class="news-row"
                                date={article.date}
                                datePlacement="below"
                                href={`/news/${article.slug}`}
                                image={props.isCompact ? undefined : articleImage(article)}
                                actions={
                                    !props.isCompact ? (
                                        <EditLink team href={`/news/edit?id=${article.id}`} />
                                    ) : undefined
                                }
                                description={
                                    <Highlight
                                        text={
                                            terms().length
                                                ? searchExcerpt(
                                                      `${article.description} ${"body" in article ? article.body : ""}`,
                                                      terms(),
                                                  )
                                                : article.description
                                        }
                                        terms={terms()}
                                    />
                                }
                                meta={
                                    <div class="entry-tags">
                                        <For each={articleTags(article)}>
                                            {(tag) => (
                                                <a class="tag" href={`/news?tag=${tag.slug}`}>
                                                    {tag.name}
                                                </a>
                                            )}
                                        </For>
                                    </div>
                                }
                                title={<Highlight text={article.title} terms={terms()} />}
                            />
                        )}
                    </For>
                </div>
            </Show>

            {/* reveal the next page without replacing existing articles */}
            <Show when={props.limit === undefined && articles().length < matches().length}>
                <div class="programme-more">
                    <button
                        class="button"
                        type="button"
                        onClick={() => setVisibleCount((count) => count + pageSize * 2)}
                    >
                        Load more
                    </button>
                    <span>
                        {articles().length} of {matches().length}
                    </span>
                </div>
            </Show>
        </Card>
    );
}

/** Use the story's organisation icon, or its initial when no organisation is linked. */
export function articleImage(article: ArticlePreview) {
    return { url: article.organisations[0]?.iconUrl, initial: article.title.slice(0, 1) };
}

/** Build searchable article text. */
function articleText(article: Article | ArticlePreview) {
    return [
        article.title,
        article.description,
        "body" in article ? article.body : "",
        new Date(article.date).toISOString().slice(0, 10),
        article.url ?? "",
        ...article.organisations.map((organisation) => organisation.name),
        ...articleTags(article).map((tag) => tag.name),
        ...article.authors.map((author) => author.name),
    ].join(" ");
}
