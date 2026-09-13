import { TableToolbar } from "../components/toolbar";
import { FilterPills } from "../components/filter-pills";
import { EventCounts } from "./counts";
import { useAccess } from "../auth/edit";
import { isTentative } from "../../convex/events/conditions";
import { useNavigate } from "@solidjs/router";
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
    const access = useAccess();
    const navigate = useNavigate();
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
            capacity: event.registration.kind === "none" ? undefined : event.registration.capacity,
            venueCapacity: event.venueCapacity,
            counts: props.workspace.counts.find((row) => row.eventId === event._id),
            status:
                event.status === "draft"
                    ? "Draft"
                    : event.status === "cancelled"
                      ? "Cancelled"
                      : event.startsAt > Date.now()
                        ? isTentative(event)
                            ? "Tentative"
                            : "Upcoming"
                        : "Past",
        }));
        const drafts = props.workspace.submissions.map((draft) => ({
            id: draft._id,
            eventId: draft.eventId,
            draftId: draft._id,
            title: draft.title,
            slug: draft.slug,
            startsAt: draft.startsAt,
            capacity: draft.registration.kind === "none" ? undefined : draft.registration.capacity,
            venueCapacity: draft.venueCapacity,
            counts: props.workspace.counts.find((row) => row.eventId === draft.eventId),
            status:
                props.workspace.statuses.find((event) => event.id === draft.eventId)?.status ===
                "cancelled"
                    ? "Cancelled"
                    : !draft.eventId ||
                        props.workspace.statuses.find((event) => event.id === draft.eventId)
                            ?.status === "draft"
                      ? "Draft"
                      : draft.startsAt > Date.now()
                        ? isTentative(
                              props.workspace.statuses.find(
                                  (event) => event.id === draft.eventId,
                              ) ?? {},
                          )
                            ? "Tentative"
                            : "Upcoming"
                        : "Past",
        }));

        return [...published, ...drafts]
            .filter(
                (row) =>
                    (filter() === "All" || row.status === filter()) &&
                    row.title.toLowerCase().includes(search().trim().toLowerCase()),
            )
            .sort((a, b) => b.startsAt - a.startsAt);
    };

    return (
        <Card
            title="Events"
            class="admin-event-card admin-table-card"
            toolbar={
                <Show when={access.canCreate()}>
                    <a class="button button--primary" href="/submit">
                        New event
                    </a>
                </Show>
            }
        >
            <FormMessage error={command.error()} success={command.success()} />
            <TableToolbar onSearch={setSearch} value={search()} placeholder="Search events…">
                <FilterPills
                    label="Event status"
                    value={filter()}
                    onChange={setFilter}
                    options={["All", "Upcoming", "Tentative", "Past", "Draft", "Cancelled"].map(
                        (label) => ({ label, value: label }),
                    )}
                />
            </TableToolbar>
            <div class="table-scroll">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th scope="col">Event</th>
                            <th scope="col">Date</th>
                            <th scope="col">Status</th>
                            <th scope="col">Registrations</th>
                            <th scope="col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={rows()}>
                            {(row) => (
                                <tr>
                                    <td>
                                        <a
                                            href={
                                                row.status === "Draft"
                                                    ? row.draftId
                                                        ? `/submit?edit=${row.draftId}`
                                                        : `/submit?event=${row.eventId}`
                                                    : `/events/${row.slug}`
                                            }
                                        >
                                            {row.title}
                                        </a>
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
                                            class="tag"
                                            classList={{
                                                "tag-upcoming": row.status === "Upcoming",
                                            }}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                    <td>
                                        <EventCounts
                                            confirmed={row.counts?.confirmed}
                                            limit={row.capacity}
                                            waitlist={row.counts?.waitlist}
                                            pending={row.counts?.pending}
                                        />
                                        <Show when={row.venueCapacity}>
                                            <div class="text-soft">Venue: {row.venueCapacity}</div>
                                        </Show>
                                    </td>
                                    <td>
                                        <div class="admin-actions" aria-label="Actions">
                                            <Show
                                                when={row.draftId}
                                                fallback={
                                                    <button
                                                        class="button"
                                                        disabled={command.isPending()}
                                                        onClick={() =>
                                                            command.perform(async () => {
                                                                const id = await (
                                                                    await memberClient()
                                                                ).mutation(
                                                                    api.events.mutations.edit,
                                                                    { eventId: row.eventId! },
                                                                );
                                                                navigate(`/submit?edit=${id}`);
                                                            }, "Opened event editor.")
                                                        }
                                                    >
                                                        Edit
                                                    </button>
                                                }
                                            >
                                                <a
                                                    class="button"
                                                    href={`/submit?edit=${row.draftId}`}
                                                >
                                                    Edit
                                                </a>
                                            </Show>
                                            <Show
                                                when={
                                                    row.eventId &&
                                                    access.canEvent(row.eventId, "organiser")
                                                }
                                            >
                                                <a
                                                    class="button"
                                                    href={`/admin?event=${row.eventId}`}
                                                >
                                                    Attendees
                                                </a>
                                            </Show>
                                            <Show when={access.canCreate()}>
                                                <button
                                                    class="button"
                                                    disabled={command.isPending()}
                                                    onClick={() =>
                                                        command.perform(async () => {
                                                            const id =
                                                                row.draftId ??
                                                                (await (
                                                                    await memberClient()
                                                                ).mutation(
                                                                    api.events.mutations.edit,
                                                                    { eventId: row.eventId! },
                                                                ));
                                                            navigate(`/submit?duplicate=${id}`);
                                                        }, "Opened event template.")
                                                    }
                                                >
                                                    Duplicate
                                                </button>
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
