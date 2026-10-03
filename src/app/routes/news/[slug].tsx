import { PageCommands } from "../../../search/actions";
import { useAccess } from "../../../auth/edit";
import { EditLink } from "../../../auth/edit";
import { Share } from "../../../components/share";
import { timeZone } from "../../site";
import { getArticle, getArticles } from "../../../news/queries";

import { isCurrentYear } from "../../../events/time";
import { useParams } from "@solidjs/router";
import { For, Show } from "solid-js";
import { articleTags } from "../../../news/tags";
import { articleImage } from "../../../news/article";
import { organisationKinds } from "../../../../convex/organisations/kinds";
import { Card } from "../../../components/card";
import { Entry } from "../../../events/entry";
import type { Article } from "../../../news/model";
import { Arrow } from "../../../components/arrow";
import "../../../news/article.css";
import { Markdown } from "../../../components/markdown";
import { NotFound } from "../../notfound";
import { Page, ItemHeader } from "../../page";
import { Seo } from "../../seo";

import { routeParam } from "../../params";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) => {
        getArticle(params.slug);
        getArticles();
    },
};

/** Read an authored news article in the shared card layout. */
export default function Route() {
    const access = useAccess();
    const params = useParams();
    const slug = () => routeParam("slug", params.slug);
    const article = getArticle.use(() => [slug()]);
    const articles = getArticles.use(() => []);

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
                    <Page>
                        <a class="eyebrow" href="/news">
                            <Arrow direction="left" /> News
                        </a>
                        <ItemHeader
                            title={post().title}
                            summary={post().description}
                            actions={<EditLink team href={`/news/edit?id=${post().id}`} />}
                        >
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

                            {/* the original story is the main destination for linked news */}
                            <Show when={post().url}>
                                {(url) => (
                                    <a
                                        class="button button--primary article-source"
                                        href={url()}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Read on {new URL(url()).hostname.replace(/^www\./, "")}{" "}
                                        <Arrow direction="external" />
                                    </a>
                                )}
                            </Show>
                        </ItemHeader>
                        <div class="detail-layout">
                            <div class="detail-content">
                                {/* authored text, when the story has any */}
                                <Show when={post().body || post().image}>
                                    <article class="card news-article" aria-label={post().title}>
                                        <div class="card-body article-content">
                                            <Show when={post().image}>
                                                <img class="news-image" src={post().image} alt="" />
                                            </Show>
                                            <Show when={post().body}>
                                                <Markdown source={post().body} />
                                            </Show>
                                        </div>
                                    </article>
                                </Show>

                                {/* who the story is about */}
                                <For each={post().organisations}>
                                    {(organisation) => (
                                        <Card title={organisation.name}>
                                            <div class="article-organisation">
                                                <Show when={organisation.iconUrl}>
                                                    {(source) => (
                                                        <img
                                                            class="article-organisation__icon"
                                                            src={source()}
                                                            alt=""
                                                        />
                                                    )}
                                                </Show>
                                                <div class="article-organisation__copy">
                                                    <p class="article-organisation__meta">
                                                        {organisationKinds[organisation.kind]} ·{" "}
                                                        {organisation.location}
                                                    </p>
                                                    <p>
                                                        {organisation.description ||
                                                            organisation.headline}
                                                    </p>
                                                    <div class="article-organisation__links">
                                                        <a
                                                            class="action-link"
                                                            href={`/organisations/${organisation.slug}`}
                                                        >
                                                            Profile <Arrow />
                                                        </a>
                                                        <a
                                                            class="action-link"
                                                            href={organisation.website}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            Website <Arrow direction="external" />
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    )}
                                </For>

                                {/* stories about the same organisations, then the same topics */}
                                <Show when={related(post(), articles() ?? []).length}>
                                    <Card title="More news" titleHref="/news">
                                        <div class="news-list">
                                            <For each={related(post(), articles() ?? [])}>
                                                {(item) => (
                                                    <Entry
                                                        class="news-row"
                                                        date={item.date}
                                                        datePlacement="below"
                                                        href={`/news/${item.slug}`}
                                                        image={articleImage(item)}
                                                        title={item.title}
                                                        description={item.description}
                                                    />
                                                )}
                                            </For>
                                        </div>
                                    </Card>
                                </Show>
                            </div>
                            <aside class="detail-aside">
                                <Share
                                    title={post().title}
                                    url={`https://zurich.tech/news/${post().slug}`}
                                />
                            </aside>
                        </div>
                    </Page>
                </>
            )}
        </Show>
    );
}

/** Pick up to four other stories, those about the same organisations first, then shared topics. */
function related(post: Article, articles: Article[]): Article[] {
    const organisations = new Set(post.organisations.map((organisation) => organisation.slug));
    const topics = new Set(post.topics.map((topic) => topic.slug));
    const score = (other: Article) =>
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
