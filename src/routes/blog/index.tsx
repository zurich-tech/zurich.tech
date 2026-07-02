import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";

import { formatDate } from "../../component/calendar";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { getPosts, type PublicPost } from "../../data/public";

/** Blog index. */
export default function Route() {
    // posts
    const posts = createAsync(() => getPosts());

    return (
        <>
            <Seo title="blog" description="zurich.tech blog." />
            <Page>
                <PageHeader title="blog" />

                {/* posts */}
                <PostDirectory posts={posts() ?? []} />
            </Page>
        </>
    );
}

/** Post directory. */
function PostDirectory(props: { posts: PublicPost[] }) {
    return (
        <Section title="posts" meta={`${props.posts.length}`}>
            {/* empty */}
            <Show when={props.posts.length > 0} fallback={<p class="text-soft">nothing yet.</p>}>
                {/* rows */}
                <ol class="grid">
                    <For each={props.posts}>{(post) => <PostRow post={post} />}</For>
                </ol>
            </Show>
        </Section>
    );
}

/** Post row: date, title, summary, inverted on hover. */
function PostRow(props: { post: PublicPost }) {
    return (
        <li class="-mx-2 border-b border-line last:border-b-0">
            <a
                class="group grid gap-1 px-2 py-3 outline-none hover:bg-ink focus:bg-ink"
                href={`/blog/${props.post.slug}`}
            >
                {/* date and title */}
                <span class="flex flex-wrap items-baseline gap-3">
                    <Show when={postDate(props.post)}>
                        <span class="text-xs whitespace-nowrap text-soft tabular-nums group-hover:text-paper/60 group-focus:text-paper/60">
                            {postDate(props.post)}
                        </span>
                    </Show>
                    <span class="font-medium group-hover:text-paper group-focus:text-paper">
                        {props.post.title}
                    </span>
                </span>

                {/* summary */}
                <span class="text-soft group-hover:text-paper/60 group-focus:text-paper/60">
                    {props.post.summary}
                </span>
            </a>
        </li>
    );
}

/** Post date. */
function postDate(post: PublicPost): string | undefined {
    if (post.date === undefined) {
        return undefined;
    }

    return formatDate(post.date);
}
