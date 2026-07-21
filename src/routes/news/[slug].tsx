import { createAsync, useParams } from "@solidjs/router";
import { Match, Show, Switch } from "solid-js";

import { formatDate } from "../../component/calendar";
import { Markdown } from "../../component/markdown";
import { Tags } from "../../component/meta";
import { NotFound } from "../../component/notfound";
import { Page } from "../../component/page";
import { Seo } from "../../component/seo";
import { getArticle, type Article } from "../../data/public";
import { routeParam } from "../../route";

/** News article. */
export default function Route() {
    // route
    const params = useParams();
    const slug = routeParam("slug", params.slug);

    // article
    const article = createAsync(() => getArticle(slug), { deferStream: true });
    const title = () => article()?.title ?? slug;

    return (
        <Switch>
            {/* missing */}
            <Match when={article() === null}>
                <NotFound />
            </Match>

            {/* article */}
            <Match when={article() !== undefined}>
                <>
                    <Seo
                        title={title()}
                        description={article()?.description ?? "zurich.tech news."}
                    />
                    <Page width="narrow">
                        <ArticleHeader article={article()} title={title()} />
                        <ArticleBody article={article()} />
                    </Page>
                </>
            </Match>
        </Switch>
    );
}

/** Article heading, publication date, description, and tags. */
function ArticleHeader(props: { article: Article | null | undefined; title: string }) {
    return (
        <header class="article-header">
            {/* date */}
            <Show when={props.article?.date}>{(date) => <time>{formatDate(date())}</time>}</Show>

            {/* title */}
            <h1>{props.title}</h1>

            {/* description */}
            <Show when={props.article?.description}>
                <p>{props.article?.description}</p>
            </Show>

            {/* tags */}
            <Tags values={props.article?.tags ?? []} />
        </header>
    );
}

/** Render one article body or its missing state. */
function ArticleBody(props: { article: Article | null | undefined }) {
    return (
        <Show when={props.article?.body} fallback={<p class="text-soft">article not found.</p>}>
            {(body) => <Markdown source={body()} />}
        </Show>
    );
}
