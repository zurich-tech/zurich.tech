import "./article.css";
import { createResource, createSignal, For, Show } from "solid-js";
import { memberClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import { Card } from "../components/card";
import { TableToolbar } from "../components/toolbar";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Browse team drafts and published posts in the standard admin table. */
export function NewsAdmin() {
    const [workspace, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.news.queries.workspace, {}),
    );
    const [search, setSearch] = createSignal("");
    const [status, setStatus] = createSignal("All");
    const posts = () =>
        workspace()?.posts.filter(
            (post) =>
                (status() === "All" || (status() === "Published") === !!post.published) &&
                post.draft.title.toLowerCase().includes(search().toLowerCase()),
        ) ?? [];
    return (
        <Card
            title="News"
            toolbar={
                <>
                    <a class="button button--primary" href="/news/edit">
                        New post
                    </a>
                    <a class="button" href="/news/edit?kind=link">
                        Add link
                    </a>
                </>
            }
        >
            <Show when={workspace.error}>
                <FormMessage error={errorMessage(workspace.error, "Could not load news.")} />
                <button class="button" onClick={() => refetch()}>
                    Retry
                </button>
            </Show>
            <TableToolbar onSearch={setSearch} placeholder="Search news…" />
            <nav class="filter-pills news-actions" aria-label="News status">
                <For each={["All", "Draft", "Published"]}>
                    {(label) => (
                        <button
                            classList={{ selected: status() === label }}
                            aria-pressed={status() === label}
                            onClick={() => setStatus(label)}
                        >
                            {label}
                        </button>
                    )}
                </For>
            </nav>
            <div class="table-scroll">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th scope="col">Title</th>
                            <th scope="col">Type</th>
                            <th scope="col">Status</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={posts()}>
                            {(post) => (
                                <tr>
                                    <td>
                                        {post.published ? (
                                            <a href={`/news/${post.slug}`}>
                                                {post.published.title}
                                            </a>
                                        ) : (
                                            post.draft.title
                                        )}
                                    </td>
                                    <td>{post.draft.kind === "link" ? "Link" : "Post"}</td>
                                    <td>{post.published ? "Published" : "Draft"}</td>
                                    <td>
                                        <div class="admin-actions" aria-label="Actions">
                                            <a class="button" href={`/news/edit?id=${post._id}`}>
                                                Edit
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </For>
                        <Show when={workspace() && !posts().length}>
                            <tr>
                                <td colSpan={4}>No news</td>
                            </tr>
                        </Show>
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
