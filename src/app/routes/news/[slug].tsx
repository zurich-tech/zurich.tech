import { PageCommands } from "../../../search/actions";
import { useAccess } from "../../../auth/edit";
import { EditLink } from "../../../auth/edit";
import { Share } from "../../../components/share";
import { timeZone } from "../../site";
import { getArticle, getHeadlines } from "../../../news/queries";

import { isCurrentYear } from "../../../events/time";
import { useParams } from "@solidjs/router";
import { For, Show } from "solid-js";
import { articleTags } from "../../../news/tags";
import { NewsMedia } from "../../../news/media";
import { organisationKinds } from "../../../../convex/organisations/kinds";
import { Card } from "../../../components/card";
import { Image } from "../../../components/image";
import type { ArticlePreview } from "../../../news/model";
import { Arrow } from "../../../components/arrow";
import "../../../news/article.css";
import { Markdown } from "../../../components/markdown";
import { NotFound } from "../../notfound";
import { Page } from "../../page";
import { Seo } from "../../seo";

import { routeParam } from "../../params";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) => {
        getArticle(params.slug);
        getHeadlines();
    },
};

/** Read a story with its source, organisations and related coverage. */
export default function Route() {
    const access = useAccess();
    const params = useParams();
    const slug = () => routeParam("slug", params.slug);
    const article = getArticle.use(() => [slug()]);
    const articles = getHeadlines.use(() => []);

    return (
        <Show when={article()} fallback={article() === null ? <NotFound /> : undefined}>
            {(post) => (
                <>
                    <PageCommands
                        items={
                            access.current()?.isAdmin || access.current()?.isTeam
                                ? [
                                      {
                                          id: "edit-news",
                                          label: "Edit this news item",
                                          group: "This news item",
                                          href: `/news/edit?id=${post().id}`,
                                      },
                                  ]
                                : []
                        }
                    />
                    <Seo
                        title={post().title}
                        description={post().description}
                        image={post().image}
                        isArticle
                    />
                    <Page class="news-detail">
                        <div class="article-navigation">
                            <a class="eyebrow" href="/news">
                                <Arrow direction="left" /> News
                            </a>
                            <EditLink team href={`/news/edit?id=${post().id}`} />
                        </div>
                        <header class="article-header">
                            <div class="article-metadata">
                                <div class="article-byline">
                                    <time dateTime={new Date(post().date).toISOString()}>
                                        {new Date(post().date).toLocaleDateString("en-GB", {
                                            day: "numeric",
                                            month: "long",
                                            year: isCurrentYear(post().date)
                                                ? undefined
                                                : "numeric",
                                            timeZone,
                                        })}
                                    </time>
                                    <For each={post().authors}>
                                        {(author) => (
                                            <Show
                                                when={author.url}
                                                fallback={<span>{author.name}</span>}
                                            >
                                                <a href={author.url}>{author.name}</a>
                                            </Show>
                                        )}
                                    </For>
                                </div>
                                <div class="entry-tags detail-tags">
                                    <For each={articleTags(post())}>
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
                            </div>
                            <h1>{post().title}</h1>
                            <p class="article-deck">{post().description}</p>
                        </header>
                        {/* keep the story in one reading column */}
                        <article class="news-article" aria-label={post().title}>
                            <NewsMedia image={post().image} video={post().video} />
                            <Show when={post().body}>
                                <Markdown source={post().body} />
                            </Show>
                            <Show when={post().url}>
                                {(url) => (
                                    <a
                                        class="action-link article-source"
                                        href={url()}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Read on {new URL(url()).hostname.replace(/^www\./, "")}{" "}
                                        <Arrow direction="external" />
                                    </a>
                                )}
                            </Show>
                        </article>
                        <footer class="article-footer">
                            <Show when={post().organisations.length}>
                                <div class="article-organisations">
                                    <For each={post().organisations}>
                                        {(organisation) => (
                                            <div
                                                class="article-organisation"
                                                classList={{
                                                    "article-organisation--text":
                                                        !organisation.iconUrl,
                                                }}
                                            >
                                                <Show when={organisation.iconUrl}>
                                                    {(source) => (
                                                        <Image
                                                            class="article-organisation__icon"
                                                            src={source()}
                                                            alt=""
                                                        />
                                                    )}
                                                </Show>
                                                <div class="article-organisation__copy">
                                                    <a
                                                        class="article-organisation__name"
                                                        href={`/organisations/${organisation.slug}`}
                                                    >
                                                        {organisation.name}
                                                    </a>
                                                    <p class="article-organisation__meta">
                                                        {organisationKinds[organisation.kind]} ·{" "}
                                                        {organisation.location}
                                                    </p>
                                                </div>
                                                <div class="article-organisation__links">
                                                    <Show when={organisation.website}>
                                                        <a
                                                            class="action-link"
                                                            href={organisation.website}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            Website <Arrow direction="external" />
                                                        </a>
                                                    </Show>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                            <Share
                                title={post().title}
                                url={`https://zurich.tech/news/${post().slug}`}
                            />
                        </footer>
                        {/* stories about the same organisations, then the same topics */}
                        <Show when={related(post(), articles() ?? []).length}>
                            <Card title="More news" titleHref="/news">
                                <div class="article-related">
                                    <For each={related(post(), articles() ?? [])}>
                                        {(item) => (
                                            <a href={`/news/${item.slug}`}>
                                                <span>{item.title}</span>
                                                <Arrow direction="right" />
                                            </a>
                                        )}
                                    </For>
                                </div>
                            </Card>
                        </Show>
                    </Page>
                </>
            )}
        </Show>
    );
}

/** Pick up to four other stories, those about the same organisations first, then shared topics. */
function related(post: ArticlePreview, articles: ArticlePreview[]): ArticlePreview[] {
    const organisations = new Set(post.organisations.map((organisation) => organisation.slug));
    const topics = new Set(post.topics.map((topic) => topic.slug));
    const score = (other: ArticlePreview) =>
        other.organisations.some((organisation) => organisations.has(organisation.slug))
            ? 2
            : other.topics.some((topic) => topics.has(topic.slug))
              ? 1
              : 0;

    return articles
        .filter((other) => other.slug !== post.slug && score(other) > 0)
        .sort((left, right) => score(right) - score(left) || right.date - left.date)
        .slice(0, 4);
}
