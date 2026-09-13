import { FilterPills } from "../components/filter-pills";
import "./article.css";
import { NewsActions } from "./actions";
import { EditLink } from "../auth/edit";
import { TagPills } from "./tags";
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
    const [kind, setKind] = createSignal("All");
    const terms = createMemo(() => searchTerms(query()));

    // filter all visible article fields
    const matches = createMemo(() => {
        return props.articles.filter(
            (article) =>
                (kind() === "All" || (article.kind ?? "post") === kind().toLowerCase()) &&
                (!props.tag || article.tags.some((tag) => tag.slug === props.tag)) &&
                matchesSearch(articleText(article), terms()),
        );
    });

    // apply the homepage limit after filtering
    const articles = createMemo(() => matches().slice(0, props.limit));

    return (
        <Card
            heading={props.isPage ? "h1" : "h2"}
            class={props.isCompact ? "news-card news-overview" : "news-card"}
            title={props.isPage || props.isCompact ? "News" : "Articles"}
            toolbar={<NewsActions isCompact={props.isCompact} />}
            titleHref={props.titleHref ?? (props.isPage ? undefined : "/news")}
        >
            <Show when={props.isCompact}>
                <div class="news-filters">
                    <TagPills articles={props.articles} selected={props.tag} />
                </div>
            </Show>
            <Show when={props.isSearchable}>
                <TableToolbar onSearch={setQuery} value={query()} placeholder="Search news…">
                    <FilterPills
                        label="News type"
                        value={kind()}
                        onChange={setKind}
                        options={["All", "Post", "Link"].map((label) => ({ label, value: label }))}
                    />
                </TableToolbar>
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
                                href={article.url ?? `/news/${article.slug}`}
                                actions={
                                    article.id && !props.isCompact ? (
                                        <EditLink href={`/news/edit?id=${article.id}`} />
                                    ) : undefined
                                }
                                description={
                                    <Highlight text={article.description} terms={terms()} />
                                }
                                meta={
                                    article.url
                                        ? new URL(article.url).hostname.replace(/^www\./, "")
                                        : props.isCompact
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
