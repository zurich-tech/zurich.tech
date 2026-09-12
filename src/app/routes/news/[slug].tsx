import { timeZone } from "../../site";
import { getArticle, getArticles } from "../../../news/queries";

import { isCurrentYear } from "../../../events/time";
import { createAsync, useParams } from "@solidjs/router";
import { For, Show } from "solid-js";
import { Tags } from "../../../news/tags";
import { Arrow } from "../../../components/arrow";
import { Card } from "../../../components/card";
import { Markdown } from "../../../components/markdown";
import { NotFound } from "../../notfound";
import { Page } from "../../page";
import { Seo } from "../../seo";

import { routeParam } from "../../params";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) =>
        Promise.all([getArticle(params.slug), getArticles()]),
};

/** Read an authored news article in the shared card layout. */
export default function Route() {
    const articles = createAsync(() => getArticles());
    const params = useParams();
    const slug = () => routeParam("slug", params.slug);
    const article = createAsync(() => getArticle(slug()), { deferStream: true });

    return (
        <Show when={article()} fallback={article() === null ? <NotFound /> : undefined}>
            {(post) => (
                <>
                    <Seo title={post().title} description={post().description} isArticle />
                    <Page>
                        <a class="eyebrow" href="/news">
                            <Arrow direction="left" /> News
                        </a>
                        <div class="listing-layout">
                            <Card title={post().title} heading="h1" class="news-article">
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
                                <p class="page-lead">{post().description}</p>
                                <div class="news-tags filter-pills">
                                    <For each={post().tags}>
                                        {(tag) => (
                                            <a href={`/news?tag=${encodeURIComponent(tag.slug)}`}>
                                                {tag.name}
                                            </a>
                                        )}
                                    </For>
                                </div>
                                <Markdown source={post().body} />
                            </Card>
                            <aside class="listing-sidebar">
                                <Tags articles={articles() ?? []} />
                            </aside>
                        </div>
                    </Page>
                </>
            )}
        </Show>
    );
}
