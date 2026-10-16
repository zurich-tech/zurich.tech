import { useSearch } from "../search/local";
import "./article.css";
import { NewsActions } from "./actions";
import { NewsMedia } from "./media";
import { EditLink } from "../auth/edit";
import { articleTags, TagPills, TopicList } from "./tags";
import { ChevronDown } from "lucide-solid";
import { articleParagraphs, type Article, type ArticlePreview } from "./model";
import { For, Show, createEffect, createMemo, createSignal, on } from "solid-js";
import type { JSX } from "solid-js";
import { pageSize } from "../app/site";
import "../events/programme.css";

import { matchesSearch, searchTerms } from "../search/search";
import { Entry } from "../events/entry";
import { Highlight } from "../components/highlight";
import { Card } from "../components/card";
import { TableToolbar } from "../components/toolbar";
import { timeZone } from "../app/site";

/** Article list properties. */
type ArticleListProps = {
    /** The articles to show. */
    articles: (Article | ArticlePreview)[];
    /** Use the collection heading as the page title. */
    isPage?: boolean;
    /** Show related stories without collection filters or actions. */
    isFeed?: boolean;
    /** Override the collection heading. */
    title?: string;
    /** Show only titles and subtitles in the homepage sidebar. */
    isCompact?: boolean;
    /** Whether to show article search. */
    isSearchable?: boolean;
    /** Collection filters displayed beside the search field. */
    filters?: JSX.Element;
    /** Filter by an exact canonical tag slug. */
    tag?: string;
    /** Restrict the feed to a linked organisation's canonical slug. */
    organisation?: string;
    /** The maximum visible article count. */
    limit?: number;
    /** The news heading destination. */
    titleHref?: string;
};

/** Render dated articles with optional search. */
export function ArticleList(props: ArticleListProps) {
    const { query, setQuery } = useSearch();
    const terms = createMemo(() => searchTerms(props.isFeed ? "" : query()));
    const selectedTopic = createMemo(() =>
        props.articles.flatMap(articleTags).find((tag) => tag.slug === props.tag),
    );

    // filter all visible article fields
    const matches = createMemo(() => {
        return props.articles.filter(
            (article) =>
                (!props.tag || articleTags(article).some((tag) => tag.slug === props.tag)) &&
                (!props.organisation ||
                    article.organisations.some(
                        (organisation) => organisation.slug === props.organisation,
                    )) &&
                matchesSearch(articleText(article), terms()),
        );
    });

    // reveal the full archive in pages, restarting whenever the filters change
    const [visibleCount, setVisibleCount] = createSignal(pageSize * 2);
    createEffect(
        on(
            [terms, () => props.tag, () => props.organisation],
            () => setVisibleCount(pageSize * 2),
            { defer: true },
        ),
    );

    // apply the homepage limit or the current page after filtering
    const articles = createMemo(() => matches().slice(0, props.limit ?? visibleCount()));

    return (
        <Card
            heading={props.isPage ? "h1" : "h2"}
            class={props.isCompact ? "news-card news-overview" : "news-card"}
            title={props.title ?? (props.isPage || props.isCompact ? "News" : "Articles")}
            toolbar={props.isFeed ? undefined : <NewsActions isCompact={props.isCompact} />}
            titleHref={props.titleHref ?? (props.isPage ? undefined : "/news")}
        >
            <Show when={!props.isSearchable && !props.isFeed}>
                <div class="news-filters">
                    <TagPills articles={props.articles} selected={props.tag} />
                </div>
            </Show>
            <Show when={props.isSearchable}>
                <TableToolbar onSearch={setQuery} value={query()} placeholder="Search news…">
                    {props.filters}
                </TableToolbar>
            </Show>
            {/* keep topic filters reachable before the archive on smaller screens */}
            <Show when={props.isPage}>
                <details
                    class="news-topics"
                    onClick={(event) => {
                        if ((event.target as Element).closest("a"))
                            event.currentTarget.open = false;
                    }}
                >
                    <summary>
                        {selectedTopic()?.name ?? "Tags"}{" "}
                        <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <TopicList
                        articles={props.articles}
                        selected={props.tag}
                        organisation={props.organisation}
                    />
                </details>
            </Show>
            {/* articles */}
            <Show
                when={articles().length > 0}
                fallback={<p class="text-soft">No news matches these filters.</p>}
            >
                <div class="news-list">
                    <For each={articles()}>
                        {(article) => (
                            <Show
                                when={props.isPage}
                                fallback={
                                    <Entry
                                        class="news-row"
                                        date={article.date}
                                        datePlacement="below"
                                        href={article.path}
                                        image={props.isCompact ? undefined : articleImage(article)}
                                        actions={
                                            !props.isCompact ? (
                                                <EditLink
                                                    team
                                                    href={`/news/edit?id=${article.id}`}
                                                />
                                            ) : undefined
                                        }
                                        description={
                                            <Highlight text={article.description} terms={terms()} />
                                        }
                                        meta={
                                            <div class="entry-tags">
                                                <For each={articleTags(article)}>
                                                    {(tag) => (
                                                        <a
                                                            class="tag"
                                                            href={`/news?tag=${tag.slug}`}
                                                        >
                                                            {tag.name}
                                                        </a>
                                                    )}
                                                </For>
                                            </div>
                                        }
                                        title={<Highlight text={article.title} terms={terms()} />}
                                    />
                                }
                            >
                                <article class="news-story">
                                    <div class="news-story__copy">
                                        <div class="news-story__date">
                                            <time dateTime={new Date(article.date).toISOString()}>
                                                {new Date(article.date).toLocaleDateString(
                                                    "en-GB",
                                                    {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                        timeZone,
                                                    },
                                                )}
                                            </time>
                                            <EditLink team href={`/news/edit?id=${article.id}`} />
                                        </div>
                                        <h2>
                                            <a href={article.path}>
                                                <Highlight text={article.title} terms={terms()} />
                                            </a>
                                        </h2>
                                        <div class="news-story__description">
                                            <For each={articleParagraphs(article.description)}>
                                                {(paragraph) => (
                                                    <p>
                                                        <Highlight
                                                            text={paragraph}
                                                            terms={terms()}
                                                        />
                                                    </p>
                                                )}
                                            </For>
                                        </div>
                                    </div>
                                    <NewsMedia
                                        image={article.image}
                                        video={article.video}
                                        caption={article.caption}
                                    />
                                    <div class="news-story__metadata">
                                        <div class="entry-tags">
                                            <For each={articleTags(article)}>
                                                {(tag) => (
                                                    <a
                                                        class="tag"
                                                        href={`/news?tag=${encodeURIComponent(tag.slug)}`}
                                                    >
                                                        {tag.name}
                                                    </a>
                                                )}
                                            </For>
                                        </div>
                                        <Show when={article.url}>
                                            <a
                                                class="action-link article-source"
                                                href={article.url}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {new URL(article.url!).hostname.replace(
                                                    /^www\./,
                                                    "",
                                                )}
                                            </a>
                                        </Show>
                                    </div>
                                </article>
                            </Show>
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
