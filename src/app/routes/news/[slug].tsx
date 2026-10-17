import { PageCommands } from "../../../search/actions";
import { useAccess, EditLink } from "../../../auth/edit";
import { Share } from "../../../components/share";
import { SocialLinks } from "../../../components/social";
import { MapPin } from "lucide-solid";
import { Card } from "../../../components/card";
import { timeZone, isCurrentYear } from "../../../../convex/events/time";
import { getArticle, getHeadlines } from "../../../news/queries";

import { useParams } from "@solidjs/router";
import { For, Show } from "solid-js";
import { articleTags } from "../../../news/tags";
import { NewsMedia } from "../../../news/media";
import { organisationKinds } from "../../../../convex/organisations/kinds";
import { ArticleList } from "../../../news/article";
import { Image } from "../../../components/image";
import { articleParagraphs, type ArticlePreview } from "../../../news/model";
import { isNewsTag } from "../../../../convex/news/tags";
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
                        description={articleParagraphs(post().description)[0] ?? ""}
                        image={post().image}
                        isArticle
                    />
                    <Page class="news-detail publication">
                        <div class="article-navigation">
                            <a class="eyebrow" href="/news">
                                <Arrow direction="left" /> News
                            </a>
                            <EditLink team href={`/news/edit?id=${post().id}`} />
                        </div>
                        <div class="detail-layout">
                            <div class="article-main">
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
                                        <Show when={post().url}>
                                            {(url) => (
                                                <a
                                                    class="action-link article-source"
                                                    href={url()}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {new URL(url()).hostname.replace(/^www\./, "")}
                                                </a>
                                            )}
                                        </Show>
                                    </div>
                                    <h1>{post().title}</h1>
                                </header>
                                {/* keep the story in one reading column */}
                                <article class="news-article" aria-label={post().title}>
                                    <div class="article-deck">
                                        <For each={articleParagraphs(post().description)}>
                                            {(paragraph) => <p>{paragraph}</p>}
                                        </For>
                                    </div>
                                    <NewsMedia
                                        image={post().image}
                                        video={post().video}
                                        caption={post().caption}
                                    />
                                    <Show when={post().body}>
                                        <Markdown source={post().body} />
                                    </Show>
                                </article>
                            </div>
                            <aside class="detail-aside article-sidebar">
                                <Share
                                    title={post().title}
                                    url={`https://zurich.tech${post().path}`}
                                />
                                <Show when={post().organisations.length}>
                                    <Card title="Entities">
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
                                                                {
                                                                    organisationKinds[
                                                                        organisation.kind
                                                                    ]
                                                                }{" "}
                                                                · {organisation.location}
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
                                                                    Website{" "}
                                                                    <Arrow direction="external" />
                                                                </a>
                                                            </Show>
                                                            <Show when={organisation.mapUrl}>
                                                                {(url) => (
                                                                    <a
                                                                        class="action-link"
                                                                        href={url()}
                                                                    >
                                                                        <MapPin
                                                                            size={14}
                                                                            aria-hidden="true"
                                                                        />{" "}
                                                                        Map
                                                                    </a>
                                                                )}
                                                            </Show>
                                                            <Show when={organisation.socials}>
                                                                {(profiles) => (
                                                                    <SocialLinks
                                                                        name={organisation.name}
                                                                        profiles={profiles()}
                                                                    />
                                                                )}
                                                            </Show>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Card>
                                </Show>
                                {/* keep recent related coverage beside the story */}
                                <Show when={related(post(), articles() ?? []).length}>
                                    <ArticleList
                                        title="More news"
                                        articles={related(post(), articles() ?? [])}
                                        isFeed
                                        isCompact
                                        limit={2}
                                    />
                                </Show>
                            </aside>
                        </div>
                    </Page>
                </>
            )}
        </Show>
    );
}

/** Pick two recent related stories, preferring shared organisations when dates match. */
function related(post: ArticlePreview, articles: ArticlePreview[]): ArticlePreview[] {
    const organisations = new Set(post.organisations.map((organisation) => organisation.slug));
    const topics = new Set(
        post.topics.map((topic) => topic.slug).filter((slug) => !isNewsTag(slug)),
    );
    const score = (other: ArticlePreview) =>
        other.organisations.some((organisation) => organisations.has(organisation.slug))
            ? 2
            : other.topics.some((topic) => topics.has(topic.slug))
              ? 1
              : 0;

    return articles
        .filter((other) => other.slug !== post.slug && score(other) > 0)
        .sort((left, right) => right.date - left.date || score(right) - score(left))
        .slice(0, 2);
}
