import { timeZone } from "../../core/constants";
import { getArticle } from "../../core/queries";

import { isCurrentYear } from "../../core/time";
import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { Arrow } from "../../component/arrow";
import { Card } from "../../component/card";
import { Markdown } from "../../component/markdown";
import { NotFound } from "../../component/notfound";
import { Page } from "../../component/page";
import { Seo } from "../../component/seo";

import { routeParam } from "../../core/route";

/** Read an authored news article in the shared card layout. */
export default function Route() {
    const params = useParams();
    const slug = routeParam("slug", params.slug);
    const article = createAsync(() => getArticle(slug), { deferStream: true });

    return (
        <Show when={article()} fallback={article() === null ? <NotFound /> : undefined}>
            {(post) => (
                <>
                    <Seo title={post().title} description={post().description} isArticle />
                    <Page width="narrow">
                        <a class="eyebrow" href="/news">
                            <Arrow direction="left" /> News
                        </a>
                        <Card title={post().title} heading="h1" class="news-article">
                            <div class="article-byline">
                                <time dateTime={new Date(post().date).toISOString()}>
                                    {new Date(post().date).toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "long",
                                        year: isCurrentYear(post().date) ? undefined : "numeric",
                                        timeZone,
                                    })}
                                </time>
                                <span>{post().author}</span>
                            </div>
                            <p class="page-lead">{post().description}</p>
                            <Markdown source={post().body} />
                        </Card>
                    </Page>
                </>
            )}
        </Show>
    );
}
