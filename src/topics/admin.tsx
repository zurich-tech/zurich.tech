import { createResource, createSignal, For, Show } from "solid-js";
import { revalidate } from "@solidjs/router";
import { api } from "../../convex/_generated/api";
import { memberClient, publicClient } from "../auth/convex";
import { Card } from "../components/card";
import { Loading } from "../components/loading";
import { Editor, savedEditor, leaveEditor, FormMessage } from "../components/form";
import { useWorkspaceCommand } from "../app/workspace";
import { getTopics } from "./queries";

/** Edit one catalogue entry at a time, protecting unsaved changes when switching records. */
export function TopicsAdmin() {
    const [topics, { refetch }] = createResource(() =>
        publicClient().query(api.topics.queries.list, {}),
    );
    const [selected, setSelected] = createSignal<string>();
    const current = () => topics()?.find((topic) => topic.slug === selected());
    const command = useWorkspaceCommand(async () => {
        await refetch();
        await revalidate(getTopics.key);
    });
    async function select(slug?: string) {
        if (await leaveEditor("topic-editor")) setSelected(slug);
    }
    async function save(event: SubmitEvent) {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const values = new FormData(form);
        const slug = String(values.get("slug"));
        await command.perform(async () => {
            await (
                await memberClient()
            ).mutation(api.topics.queries.save, {
                slug,
                name: String(values.get("name")),
                isActive: values.has("isActive"),
            });
            savedEditor(form);
            setSelected(slug);
        }, "Topic saved.");
    }
    return (
        <Card
            title={selected() === "new" ? "New topic" : (current()?.name ?? "Topics")}
            class={!selected() ? "admin-table-card" : undefined}
            toolbar={
                <Show
                    when={selected()}
                    fallback={
                        <button class="action-link" onClick={() => void select("new")}>
                            New topic
                        </button>
                    }
                >
                    <button
                        class="action-link"
                        disabled={command.isPending()}
                        onClick={() => void select()}
                    >
                        Back
                    </button>
                    <button
                        class="button button--primary"
                        type="submit"
                        form="topic-editor"
                        disabled={command.isPending()}
                    >
                        Save
                    </button>
                </Show>
            }
        >
            <FormMessage
                error={command.error() || (topics.error ? "Could not load topics." : undefined)}
                success={command.success()}
            />
            <Show when={topics.loading}>
                <Loading />
            </Show>
            <Show
                when={selected()}
                fallback={
                    <>
                        <p class="admin-context">
                            Shared by events, series, news and member interests.
                        </p>
                        <div class="table-scroll">
                            <table class="admin-table">
                                <thead>
                                    <tr>
                                        <th>Topic</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <For each={topics()}>
                                        {(topic) => (
                                            <tr>
                                                <td>{topic.name}</td>
                                                <td>{topic.isActive ? "Available" : "Archived"}</td>
                                                <td>
                                                    <button
                                                        class="action-link"
                                                        onClick={() => void select(topic.slug)}
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </>
                }
            >
                <Editor id="topic-editor" class="editor" onSubmit={save}>
                    <div class="form-columns">
                        <label>
                            Name
                            <input
                                required
                                name="name"
                                value={current()?.name ?? ""}
                                maxlength="60"
                            />
                        </label>
                        <label>
                            Key
                            <input
                                required
                                name="slug"
                                value={current()?.slug ?? ""}
                                readonly={selected() !== "new"}
                                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                maxlength="60"
                            />
                            <span>Fixed once created; used in links and stored selections.</span>
                        </label>
                    </div>
                    <label class="checkbox">
                        <input
                            type="checkbox"
                            name="isActive"
                            checked={current()?.isActive ?? true}
                        />
                        Available for selection
                    </label>
                    <p>Archived topics remain on existing content but cannot be newly assigned.</p>
                    <div class="form-actions">
                        <button class="button button--primary" disabled={command.isPending()}>
                            Save
                        </button>
                    </div>
                </Editor>
            </Show>
        </Card>
    );
}
