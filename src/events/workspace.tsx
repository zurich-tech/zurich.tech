import { Empty } from "../components/empty";
import { For, Show, createSignal } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useWorkspaceCommand, type EventWorkspace } from "../app/workspace";
import { FormMessage } from "../components/form";
import { Card } from "../components/card";
import { timeZone } from "../app/site";

/** Manage published events and drafts in one searchable table. */
export function EventAdmin(props: { workspace: EventWorkspace; refresh: () => unknown }) {
    const command = useWorkspaceCommand(props.refresh);
    const [search, setSearch] = createSignal("");
    const [filter, setFilter] = createSignal("All");
    const rows = () => {
        const published = props.workspace.published.map((event) => ({
            id: event._id,
            eventId: event._id,
            draftId: undefined as string | undefined,
            title: event.title,
            slug: event.slug,
            startsAt: event.startsAt,
            status:
                event.status === "cancelled"
                    ? "Cancelled"
                    : event.startsAt > Date.now()
                      ? "Upcoming"
                      : "Past",
        }));
        const drafts = props.workspace.submissions.map((draft) => ({
            id: draft._id,
            eventId: draft.eventId,
            draftId: draft._id,
            title: draft.title,
            slug: draft.slug,
            startsAt: draft.startsAt,
            status:
                props.workspace.statuses.find((event) => event.id === draft.eventId)?.status ===
                "cancelled"
                    ? "Cancelled"
                    : draft.status === "draft"
                      ? "Draft"
                      : draft.startsAt > Date.now()
                        ? "Upcoming"
                        : "Past",
        }));

        return [...published, ...drafts]
            .filter(
                (row) =>
                    (filter() === "All" || row.status === filter()) &&
                    row.title.toLowerCase().includes(search().trim().toLowerCase()),
            )
            .sort((a, b) => {
                const rank = (status: string) =>
                    ({ Upcoming: 0, Draft: 1, Past: 2, Cancelled: 3 })[status] ?? 4;
                return (
                    rank(a.status) - rank(b.status) ||
                    (a.status === "Upcoming" ? a.startsAt - b.startsAt : b.startsAt - a.startsAt)
                );
            });
    };

    return (
        <Card
            title="Events"
            class="admin-event-card"
            toolbar={
                <a class="button button--primary" href="/submit">
                    New event
                </a>
            }
        >
            <FormMessage error={command.error()} success={command.success()} />
            <div class="table-toolbar admin-filters">
                <input
                    type="search"
                    aria-label="Search events"
                    placeholder="Search events…"
                    value={search()}
                    onInput={(event) => setSearch(event.currentTarget.value)}
                />
                <div class="filter-bar">
                    <For each={["All", "Upcoming", "Past", "Draft", "Cancelled"]}>
                        {(value) => (
                            <button
                                classList={{ active: filter() === value }}
                                aria-pressed={filter() === value}
                                onClick={() => setFilter(value)}
                            >
                                {value}
                            </button>
                        )}
                    </For>
                </div>
            </div>
            <div class="table-scroll">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th scope="col">Event</th>
                            <th scope="col">Date</th>
                            <th scope="col">Status</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={rows()}>
                            {(row) => (
                                <tr>
                                    <td>
                                        <Show when={row.eventId} fallback={row.title}>
                                            <a href={`/events/${row.slug}`}>{row.title}</a>
                                        </Show>
                                    </td>
                                    <td>
                                        {new Date(row.startsAt).toLocaleDateString("en-GB", {
                                            timeZone,
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </td>
                                    <td>
                                        <span
                                            class="admin-status"
                                            classList={{
                                                "admin-status--upcoming": row.status === "Upcoming",
                                            }}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="admin-event-actions">
                                            <Show
                                                when={row.draftId}
                                                fallback={
                                                    <button
                                                        disabled={command.isPending()}
                                                        onClick={() =>
                                                            command.perform(async () => {
                                                                const id = await (
                                                                    await memberClient()
                                                                ).mutation(
                                                                    api.events.mutations.edit,
                                                                    { eventId: row.eventId! },
                                                                );
                                                                window.location.assign(
                                                                    `/submit?edit=${id}`,
                                                                );
                                                            }, "Opened event editor.")
                                                        }
                                                    >
                                                        Edit
                                                    </button>
                                                }
                                            >
                                                <a href={`/submit?edit=${row.draftId}`}>Edit</a>
                                            </Show>
                                            <Show when={row.eventId}>
                                                <a href={`/admin?event=${row.eventId}`}>
                                                    Attendees
                                                </a>
                                            </Show>
                                            <Show when={row.draftId}>
                                                <a href={`/submit?duplicate=${row.draftId}`}>
                                                    Duplicate
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
            <Show when={!rows().length}>
                <Empty title="No matching events" />
            </Show>
        </Card>
    );
}
