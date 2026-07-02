import { createAsync, useParams } from "@solidjs/router";
import { For, Show } from "solid-js";

import { formatDate } from "../../component/calendar";
import { Page } from "../../component/page";
import { Seo } from "../../component/seo";
import { routeParam } from "../../route";
import { getPost, type PublicPost } from "../../data/public";

/** Blog post. */
export default function Route() {
    // route params
    const params = useParams();
    const slug = routeParam("slug", params.slug);

    // post
    const post = createAsync(() => getPost(slug));
    const title = () => post()?.title ?? slug;

    return (
        <>
            <Seo title={title()} description={post()?.summary ?? "zurich.tech blog."} />
            <Page width="narrow">
                <PostHeader post={post()} title={title()} />
                <PostBody post={post()} />
            </Page>
        </>
    );
}

/** Post header. */
function PostHeader(props: { post: PublicPost | null | undefined; title: string }) {
    return (
        <header class="grid gap-1 border-b border-line pb-6">
            {/* date */}
            <Show when={props.post?.date}>
                {(date) => <p class="text-xs lowercase text-soft">{formatDate(date())}</p>}
            </Show>

            {/* title */}
            <h1 class="text-xl font-medium lowercase">{props.title}</h1>

            {/* summary */}
            <Show when={props.post?.summary}>
                <p class="max-w-2xl text-soft">{props.post?.summary}</p>
            </Show>
        </header>
    );
}

/** Post body. */
function PostBody(props: { post: PublicPost | null | undefined }) {
    return (
        <div class="grid max-w-2xl gap-4 text-ink">
            {/* paragraphs */}
            <For each={paragraphs(props.post)}>{(paragraph) => <p>{paragraph}</p>}</For>
        </div>
    );
}

/** Post paragraphs. */
function paragraphs(post: PublicPost | null | undefined): string[] {
    return post?.body ?? ["post not found."];
}
