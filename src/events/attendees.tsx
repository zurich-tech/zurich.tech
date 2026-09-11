import { For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useWorkspaceCommand, type Perform, type AttendeeList } from "../app/workspace";
import { FormMessage } from "../components/form";
import { createResource } from "solid-js";
import type { Id } from "../../convex/_generated/dataModel";
import type { Registration } from "../../convex/events/fields";
import { errorMessage } from "../components/errors";

/** Load and manage attendance for one selected event. */
export function Attendees(props: {
    /** Event selected through the workspace URL. */
    eventId: string;
}) {
    const [attendees, { refetch }] = createResource(
        () => props.eventId,
        async (eventId) =>
            (await memberClient()).query(api.events.registrations.list, {
                eventId: eventId as Id<"events">,
            }),
    );
    const command = useWorkspaceCommand(refetch);

    /** Export the visible attendee records as spreadsheet-safe CSV. */
    function exportAttendees() {
        // read only the currently visible attendees
        const rows = attendees()?.rows;
        if (!rows) return;

        // escape CSV cells and prevent spreadsheet formula execution
        const cell = (value: string) =>
            `"${(/^[=+@\-]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
        const csv = [
            ["Name", "Email", "Status", "Answers"],
            ...rows.map((row) => [
                row.name ?? "",
                row.email ?? "",
                row.status,
                (row.answers ?? []).join(" | "),
            ]),
        ]
            .map((row) => row.map(cell).join(","))
            .join("\r\n");

        // download the export and release its temporary URL
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "attendees.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <>
            <Show when={attendees.error}>
                <p class="form-error">
                    {errorMessage(attendees.error, "Could not load attendees.")}
                </p>
            </Show>
            <FormMessage error={command.error()} success={command.success()} />
            <Show when={attendees()}>
                {(list) => (
                    <AttendeeTable
                        list={list()}
                        onExport={exportAttendees}
                        isPending={command.isPending()}
                        perform={command.perform}
                    />
                )}
            </Show>
        </>
    );
}

/** Show the selected event’s attendees and cancellation controls. */
function AttendeeTable(props: {
    /** Event and attendee records. */
    list: AttendeeList;
    /** Download the visible attendee records. */
    onExport: () => void;
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
    /** Run a command and refresh its visible result. */
    perform: Perform;
}) {
    return (
        <section class="attendee-section">
            <div class="section-intro--row">
                <h2>{props.list.event.title} · Attendees</h2>
                <button class="button" onClick={props.onExport}>
                    Export CSV
                </button>
            </div>
            <div class="table-scroll">
                <table>
                    <thead>
                        <tr>
                            <th>Name / email</th>
                            <th>Status</th>
                            <th>Answers</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={props.list.rows}>
                            {(row) => (
                                <AttendeeRow
                                    attendee={row}
                                    policy={props.list.event.registration}
                                    isPending={props.isPending}
                                    perform={props.perform}
                                />
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
            <Show when={props.list.rows.length === 0}>
                <p>No registrations yet.</p>
            </Show>
            <button
                class="button"
                disabled={props.isPending || props.list.event.status === "cancelled"}
                onClick={() => {
                    if (window.confirm("Cancel this event and notify its attendees?"))
                        void props.perform(
                            async () =>
                                await (
                                    await memberClient()
                                ).mutation(api.events.mutations.cancel, {
                                    eventId: props.list.event._id,
                                }),
                            "Event cancelled.",
                        );
                }}
            >
                Cancel event & notify attendees
            </button>
        </section>
    );
}

/** Render one attendee and their admission actions. */
function AttendeeRow(props: {
    /** Registration being reviewed. */
    attendee: AttendeeList["rows"][number];
    /** Questions associated with the registration. */
    policy: Registration;
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
    /** Run a command and refresh its visible result. */
    perform: Perform;
}) {
    return (
        <tr>
            <td>
                {props.attendee.name}
                <br />
                <small>{props.attendee.email}</small>
            </td>
            <td>{props.attendee.status}</td>
            <td>
                <For each={props.attendee.answers}>
                    {(answer, index) => (
                        <p>
                            <strong>{questionLabel(props.policy, index())}</strong>
                            <br />
                            {answer}
                        </p>
                    )}
                </For>
            </td>
            <td>
                <Show when={props.attendee.status === "pending"}>
                    <button
                        disabled={props.isPending}
                        onClick={() =>
                            props.perform(
                                async () =>
                                    await (
                                        await memberClient()
                                    ).mutation(api.events.registrations.decide, {
                                        id: props.attendee._id,
                                        decision: "approve",
                                    }),
                                "Application approved.",
                            )
                        }
                    >
                        Approve
                    </button>
                    <button
                        disabled={props.isPending}
                        onClick={() =>
                            props.perform(
                                async () =>
                                    await (
                                        await memberClient()
                                    ).mutation(api.events.registrations.decide, {
                                        id: props.attendee._id,
                                        decision: "decline",
                                    }),
                                "Application declined.",
                            )
                        }
                    >
                        Decline
                    </button>
                </Show>
                <Show
                    when={
                        props.attendee.status !== "cancelled" &&
                        props.attendee.status !== "declined"
                    }
                >
                    <button
                        disabled={props.isPending}
                        onClick={() =>
                            props.perform(
                                async () =>
                                    await (
                                        await memberClient()
                                    ).mutation(api.events.registrations.decide, {
                                        id: props.attendee._id,
                                        decision: "cancel",
                                    }),
                                "Registration cancelled.",
                            )
                        }
                    >
                        Cancel
                    </button>
                </Show>
            </td>
        </tr>
    );
}

/** Read one native attendee question label. */
function questionLabel(policy: Registration, index: number) {
    return policy.kind === "native" ? policy.questions[index]?.label : "Answer";
}
