import { DeleteRecord } from "./delete";
import { useConfirmation } from "../components/dialog";
import { Card } from "../components/card";
import { createSignal, createUniqueId, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useWorkspaceCommand } from "../app/workspace";
import { leaveEditor, savedEditor, Editor, FormMessage } from "../components/form";
import { createAsync, revalidate, useSearchParams } from "@solidjs/router";
import { getDirectory } from "../organisations/queries";
import type { Id } from "../../convex/_generated/dataModel";

/** Public organisations and recurring event series. */
type Directory = Awaited<ReturnType<typeof getDirectory>>;

/** Edit the recurring event series catalogue. */
export function SeriesAdmin() {
    const confirm = useConfirmation();
    const formId = createUniqueId();
    const directory = createAsync(() => getDirectory());
    const { perform, isPending, error, success } = useWorkspaceCommand(() =>
        revalidate(getDirectory.key),
    );

    /** Save a team-maintained event series. */
    async function saveSeries(event: SubmitEvent) {
        // read the submitted fields
        event.preventDefault();
        const editor = event.currentTarget as HTMLFormElement;
        const values = new FormData(event.currentTarget as HTMLFormElement);
        const text = (key: string) => String(values.get(key) ?? "");

        // save and refresh the visible catalogue
        await perform(async () => {
            await (
                await memberClient()
            ).mutation(api.events.series.upsert, {
                id: text("id") ? (text("id") as Id<"series">) : undefined,
                name: text("name"),
                slug: text("slug"),
                description: text("description"),
                topics: text("topics")
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
            });
            savedEditor(editor);
        }, "Series saved.");
    }

    const [params] = useSearchParams();
    const [selected, setSelected] = createSignal<string | undefined>(
        typeof params.series === "string" && !params.schedule ? params.series : undefined,
    );
    const editing = () => directory()?.series.find((item) => item._id === selected());

    return (
        <Card
            title="Series"
            class={!selected() ? "admin-table-card" : undefined}
            toolbar={
                <>
                    <Show when={editing()}>
                        {(item) => (
                            <>
                                <DeleteRecord
                                    id={item()._id}
                                    name="series"
                                    onDeleted={async () => {
                                        setSelected(undefined);
                                        await revalidate(getDirectory.key);
                                    }}
                                />
                                <button
                                    class="button"
                                    disabled={isPending()}
                                    onClick={async () => {
                                        const isArchived = item().status !== "archived";
                                        if (
                                            !(await confirm({
                                                title: isArchived
                                                    ? "Archive series"
                                                    : "Restore series",
                                                action: isArchived ? "Archive" : "Restore",
                                                description: isArchived
                                                    ? "Pause all schedules and retain existing events."
                                                    : "Make the series available again. Schedules remain paused.",
                                                emails: 0,
                                            }))
                                        )
                                            return;
                                        await perform(
                                            async () =>
                                                (await memberClient()).mutation(
                                                    api.events.series.archive,
                                                    { id: item()._id, isArchived },
                                                ),
                                            isArchived ? "Series archived." : "Series restored.",
                                        );
                                    }}
                                >
                                    {item().status === "archived" ? "Restore" : "Archive"}
                                </button>
                            </>
                        )}
                    </Show>
                    <Show when={selected()}>
                        <button
                            class="button button--primary"
                            type="submit"
                            form={formId}
                            disabled={isPending()}
                        >
                            {isPending() ? "Saving…" : "Save"}
                        </button>
                    </Show>
                    <button
                        class="button"
                        classList={{ "button--primary": !selected() }}
                        onClick={async () => {
                            if (!(await leaveEditor(formId))) return;
                            setSelected(selected() ? undefined : "new");
                        }}
                    >
                        {selected() ? "Back" : "New series"}
                    </button>
                </>
            }
        >
            <FormMessage error={error()} success={success()} />
            <Show
                when={selected()}
                fallback={
                    <div class="table-scroll">
                        <table class="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Slug</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={directory()?.series}>
                                    {(item) => (
                                        <tr>
                                            <td>
                                                {item.name}
                                                <Show when={item.status === "archived"}>
                                                    {" "}
                                                    · Archived
                                                </Show>
                                            </td>
                                            <td>{item.slug}</td>
                                            <td>
                                                <div class="admin-actions">
                                                    <button
                                                        class="button"
                                                        onClick={() => setSelected(item._id)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <Show when={item.status !== "archived"}>
                                                        <a
                                                            class="button"
                                                            href={`/admin?section=series&schedule=new&series=${item._id}`}
                                                        >
                                                            New schedule
                                                        </a>
                                                    </Show>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </For>
                            </tbody>
                        </table>
                    </div>
                }
            >
                <SeriesForm
                    formId={formId}
                    item={editing()}
                    onSubmit={saveSeries}
                    isPending={isPending()}
                />
            </Show>
        </Card>
    );
}

/** Edit a recurring series and its default topics. */
function SeriesForm(props: {
    formId: string;
    /** Series being edited, or absent for a new series. */
    item?: Directory["series"][number];
    /** Save the authored series. */
    onSubmit: (event: SubmitEvent) => Promise<void>;
    /** Disable submission while saving. */
    isPending: boolean;
}) {
    return (
        <Editor
            id={props.formId}
            class="editor"
            onSubmit={props.onSubmit}
            actions={() => (
                <div class="form-actions">
                    <button class="button button--primary" disabled={props.isPending}>
                        {props.isPending ? "Saving…" : "Save"}
                    </button>
                </div>
            )}
        >
            <input type="hidden" name="id" value={props.item?._id ?? ""} />
            <div class="form-columns">
                <label>
                    Name
                    <input required name="name" value={props.item?.name ?? ""} />
                </label>
                <label>
                    Slug
                    <input required name="slug" value={props.item?.slug ?? ""} />
                </label>
            </div>
            <label>
                Description
                <textarea required name="description" value={props.item?.description ?? ""} />
            </label>
            <label>
                Topics
                <input name="topics" value={props.item?.topics.join(", ") ?? ""} />
            </label>
        </Editor>
    );
}
