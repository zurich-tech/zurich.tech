import { FilterPills } from "../components/filter-pills";
import "./article.css";
import { createResource, createSignal, For, Show } from "solid-js";
import { memberClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import { Card } from "../components/card";
import { TableToolbar } from "../components/toolbar";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";
import { newsDate, newsPath } from "../../convex/news/path";

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
            class="admin-table-card news-workspace"
            toolbar={
                <>
                    <a class="action-link" href="/news/edit">
                        New post
                    </a>
                    <a class="action-link" href="/news/edit?kind=link">
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
            <TableToolbar onSearch={setSearch} value={search()} placeholder="Search news…">
                <FilterPills
                    label="News status"
                    value={status()}
                    onChange={setStatus}
                    options={["All", "Draft", "Published"].map((label) => ({
                        label,
                        value: label,
                    }))}
                />
            </TableToolbar>
            <div class="table-scroll">
                <table class="admin-table" role="table">
                    <thead role="rowgroup">
                        <tr role="row">
                            <th scope="col" role="columnheader">
                                Title
                            </th>
                            <th scope="col" role="columnheader">
                                Type
                            </th>
                            <th scope="col" role="columnheader">
                                Status
                            </th>
                            <th scope="col" role="columnheader">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody role="rowgroup">
                        <For each={posts()}>
                            {(post) => (
                                <tr role="row">
                                    <td role="cell">
                                        {post.published ? (
                                            <a
                                                href={newsPath({
                                                    slug: post.slug,
                                                    date: newsDate(post),
                                                })}
                                            >
                                                {post.published.title}
                                            </a>
                                        ) : (
                                            post.draft.title
                                        )}
                                    </td>
                                    <td role="cell">
                                        {post.draft.kind === "link" ? "Link" : "Post"}
                                    </td>
                                    <td role="cell">
                                        <span
                                            class="tag tag-status"
                                            classList={{ "tag-upcoming": !!post.published }}
                                        >
                                            {post.published ? "Published" : "Draft"}
                                        </span>
                                    </td>
                                    <td role="cell">
                                        <div class="admin-actions" aria-label="Actions">
                                            <a
                                                class="action-link"
                                                href={`/news/edit?id=${post._id}`}
                                            >
                                                Edit
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </For>
                        <Show when={workspace() && !posts().length}>
                            <tr role="row">
                                <td role="cell" colSpan={4}>
                                    No news
                                </td>
                            </tr>
                        </Show>
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
