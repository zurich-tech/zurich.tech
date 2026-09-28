import { PageCommands } from "../../../search/actions";
import { useAccess } from "../../../auth/edit";
import { EditLink } from "../../../auth/edit";
import { Share } from "../../../components/share";
import { timeZone } from "../../site";
import { getArticle } from "../../../news/queries";

import { isCurrentYear } from "../../../events/time";
import { useParams } from "@solidjs/router";
import { For, Show } from "solid-js";
import { articleTags } from "../../../news/tags";
import { Arrow } from "../../../components/arrow";
import { ExternalTag } from "../../../components/tag";
import "../../../news/article.css";
import { Markdown } from "../../../components/markdown";
import { NotFound } from "../../notfound";
import { Page, ItemHeader } from "../../page";
import { Seo } from "../../seo";

import { routeParam } from "../../params";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) => getArticle(params.slug),
};

/** Read an authored news article in the shared card layout. */
export default function Route() {
    const access = useAccess();
    const params = useParams();
    const slug = () => routeParam("slug", params.slug);
    const article = getArticle.use(() => [slug()]);

    return (
        <Show when={article()} fallback={article() === null ? <NotFound /> : undefined}>
            {(post) => (
                <>
                    <PageCommands
                        items={
                            access.current()?.isAdmin
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
                            actions={<EditLink href={`/news/edit?id=${post().id}`} />}
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
                                    <Show when={post().url}>
                                        <ExternalTag />
                                    </Show>
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
                                    <For each={post().organisations}>
                                        {(organisation) => (
                                            <a
                                                class="tag"
                                                href={`/organisations/${organisation.slug}`}
                                            >
                                                {organisation.name}
                                            </a>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </ItemHeader>
                        <div class="listing-layout">
                            <article class="card news-article" aria-label={post().title}>
                                <div class="card-body article-content">
                                    <Show when={post().image}>
                                        <img class="news-image" src={post().image} alt="" />
                                    </Show>
                                    <Show when={post().body}>
                                        <Markdown source={post().body} />
                                    </Show>
                                    <Show when={post().url}>
                                        {(url) => (
                                            <a class="button" href={url()}>
                                                Read on{" "}
                                                {new URL(url()).hostname.replace(/^www\./, "")}{" "}
                                                <Arrow direction="external" />
                                            </a>
                                        )}
                                    </Show>
                                </div>
                            </article>
                            <aside class="listing-sidebar">
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
