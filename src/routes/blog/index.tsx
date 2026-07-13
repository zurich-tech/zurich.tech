import { createAsync } from "@solidjs/router";
import { For, Show, createMemo, createSignal } from "solid-js";

import { formatDate } from "../../component/calendar";
import { DirectoryList, DirectoryRow } from "../../component/list";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { TableToolbar } from "../../component/toolbar";
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
    const [query, setQuery] = createSignal("");

    // filter visible posts by title and abstract
    const visible = createMemo(() => {
        const text = query().trim().toLowerCase();
        if (text.length === 0) {
            return props.posts;
        }

        return props.posts.filter((post) =>
            `${post.title} ${post.summary}`.toLowerCase().includes(text),
        );
    });

    return (
        <Section
            meta={`${visible().length} / ${props.posts.length}`}
            title="posts"
            toolbar={<TableToolbar onSearch={setQuery} placeholder="search posts..." />}
        >
            {/* empty */}
            <Show when={visible().length > 0} fallback={<p class="text-soft">no posts</p>}>
                <DirectoryList>
                    <For each={visible()}>
                        {(post) => (
                            <DirectoryRow
                                eyebrow={postDate(post)}
                                href={`/blog/${post.slug}`}
                                summary={post.summary}
                                title={post.title}
                            />
                        )}
                    </For>
                </DirectoryList>
            </Show>
        </Section>
    );
}

/** Post date. */
function postDate(post: PublicPost): string | undefined {
    if (post.date === undefined) {
        return undefined;
    }

    return formatDate(post.date);
}
