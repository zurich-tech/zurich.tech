import { Card } from "../components/card";
import { createSignal, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useWorkspaceCommand } from "../app/workspace";
import { FormMessage } from "../components/form";
import { createAsync, revalidate } from "@solidjs/router";
import { getDirectory } from "../organisations/queries";
import type { Id } from "../../convex/_generated/dataModel";

/** Public organisations and recurring event series. */
type Directory = Awaited<ReturnType<typeof getDirectory>>;

/** Edit the recurring event series catalogue. */
export function SeriesAdmin() {
    const directory = createAsync(() => getDirectory());
    const { perform, isPending, error, success } = useWorkspaceCommand(() =>
        revalidate(getDirectory.key),
    );

    /** Save a team-maintained event series. */
    async function saveSeries(event: SubmitEvent) {
        // read the submitted fields
        event.preventDefault();
        const values = new FormData(event.currentTarget as HTMLFormElement);
        const text = (key: string) => String(values.get(key) ?? "");

        // save and refresh the visible catalogue
        await perform(
            async () =>
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
                }),
            "Series saved.",
        );
    }

    const [selected, setSelected] = createSignal<string>();
    const editing = () => directory()?.series.find((item) => item._id === selected());

    return (
        <Card
            title="Series"
            class={!selected() ? "admin-table-card" : undefined}
            toolbar={
                <button
                    class="button"
                    classList={{ "button--primary": !selected() }}
                    onClick={() => {
                        setSelected(selected() ? undefined : "new");
                    }}
                >
                    {selected() ? "Cancel" : "New series"}
                </button>
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
                                            <td>{item.name}</td>
                                            <td>{item.slug}</td>
                                            <td>
                                                <button
                                                    class="text-link"
                                                    onClick={() => setSelected(item._id)}
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
                }
            >
                <SeriesForm item={editing()} onSubmit={saveSeries} isPending={isPending()} />
            </Show>
        </Card>
    );
}

/** Edit a recurring series and its default topics. */
function SeriesForm(props: {
    /** Series being edited, or absent for a new series. */
    item?: Directory["series"][number];
    /** Save the authored series. */
    onSubmit: (event: SubmitEvent) => Promise<void>;
    /** Disable submission while saving. */
    isPending: boolean;
}) {
    return (
        <form class="editor" onSubmit={props.onSubmit}>
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
            <button class="button button--primary" disabled={props.isPending}>
                Save series
            </button>
        </form>
    );
}
