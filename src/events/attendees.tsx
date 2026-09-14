import { useConfirmation } from "../components/dialog";
import { FilterPills } from "../components/filter-pills";
import { confirmEvent } from "./actions";
import { Empty } from "../components/empty";
import { Card } from "../components/card";
import { For, Show, createSignal } from "solid-js";
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
    const confirm = useConfirmation();
    const [search, setSearch] = createSignal("");
    const [status, setStatus] = createSignal("all");
    const hasAnswers = () => props.list.rows.some((row) => row.answers?.some(Boolean));
    const rows = () =>
        props.list.rows.filter(
            (row) =>
                (status() === "all" || row.status === status()) &&
                `${row.name} ${row.email}`.toLowerCase().includes(search().trim().toLowerCase()),
        );

    return (
        <Card
            title="Attendees"
            class="admin-attendees"
            toolbar={
                <div class="admin-attendee-actions">
                    <a class="action-link" href="/admin">
                        Back
                    </a>
                    <button
                        class="button"
                        disabled={!props.list.rows.length}
                        onClick={props.onExport}
                    >
                        Export CSV
                    </button>
                </div>
            }
        >
            <div class="form-actions">
                <Show when={props.list.event.checkIn?.isEnabled}>
                    <a class="button" href={`/checkin?event=${props.list.event._id}`}>
                        Check in
                    </a>
                </Show>
                <a class="action-link" href={`/feedback?event=${props.list.event._id}`}>
                    Feedback
                </a>
            </div>
            <div class="admin-context">
                <a href={`/events/${props.list.event.slug}`}>{props.list.event.title}</a>
            </div>
            <Show when={props.list.rows.length > 0}>
                <div class="admin-filters">
                    <input
                        type="search"
                        aria-label="Search attendees"
                        placeholder="Search attendees…"
                        value={search()}
                        onInput={(event) => setSearch(event.currentTarget.value)}
                    />
                    <FilterPills
                        label="Registration status"
                        value={status()}
                        onChange={setStatus}
                        options={[
                            { value: "all", label: "All" },
                            { value: "going", label: "Confirmed" },
                            { value: "pending", label: "Pending" },
                            { value: "waitlist", label: "Waitlisted" },
                            { value: "declined", label: "Declined" },
                            { value: "cancelled", label: "Cancelled" },
                        ]}
                    />
                </div>
            </Show>
            <Show
                when={rows().length > 0}
                fallback={
                    <Empty
                        title={
                            props.list.rows.length
                                ? "No matching registrations"
                                : "No registrations yet"
                        }
                    />
                }
            >
                <div class="table-scroll">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>Name / email</th>
                                <th>Status</th>
                                <Show when={hasAnswers()}>
                                    <th>Answers</th>
                                </Show>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={rows()}>
                                {(row) => (
                                    <AttendeeRow
                                        attendee={row}
                                        hasAnswers={hasAnswers()}
                                        policy={props.list.event.registration}
                                        isOpen={
                                            props.list.event.status === "scheduled" &&
                                            props.list.event.startsAt > Date.now()
                                        }
                                        isPending={props.isPending}
                                        perform={props.perform}
                                    />
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>
            </Show>
            <div class="admin-card-footer">
                <button
                    class="button"
                    disabled={props.isPending || props.list.event.status === "cancelled"}
                    onClick={() =>
                        void props.perform(async () => {
                            const eventId = props.list.event._id;
                            const receipt = await confirmEvent(
                                { eventId, action: "cancel" },
                                "Cancel event",
                                confirm,
                            );
                            if (receipt !== undefined)
                                await (
                                    await memberClient()
                                ).mutation(api.events.mutations.cancel, { eventId, receipt });
                        }, "")
                    }
                >
                    Cancel
                </button>
            </div>
        </Card>
    );
}

/** Render one attendee and their admission actions. */
function AttendeeRow(props: {
    /** Registration being reviewed. */
    attendee: AttendeeList["rows"][number];
    /** Questions associated with the registration. */
    policy: Registration;
    /** Whether any registration has answers to display. */
    hasAnswers: boolean;
    isOpen: boolean;
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
    /** Run a command and refresh its visible result. */
    perform: Perform;
}) {
    const confirm = useConfirmation();
    return (
        <tr>
            <td>
                {props.attendee.name}
                <br />
                <small>{props.attendee.email}</small>
            </td>
            <td>
                {
                    {
                        going: "Confirmed",
                        pending: "Pending",
                        waitlist: "Waitlisted",
                        declined: "Declined",
                        cancelled: "Cancelled",
                    }[props.attendee.status]
                }
            </td>
            <Show when={props.hasAnswers}>
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
            </Show>
            <td>
                <div class="admin-actions" aria-label="Actions">
                    <For
                        each={[
                            {
                                decision: "approve" as const,
                                label: "Approve",
                                visible:
                                    props.isOpen &&
                                    ["pending", "waitlist"].includes(props.attendee.status),
                            },
                            {
                                decision: "waitlist" as const,
                                label: "Waitlist",
                                visible:
                                    props.isOpen &&
                                    ["pending", "going"].includes(props.attendee.status),
                            },
                            {
                                decision: "rescind" as const,
                                label: "Rescind approval",
                                visible:
                                    props.isOpen &&
                                    (props.attendee.status === "going" ||
                                        (props.attendee.status === "waitlist" &&
                                            props.attendee.approvedAt !== undefined)),
                            },
                            {
                                decision: "decline" as const,
                                label: "Decline",
                                visible: ["pending", "waitlist"].includes(props.attendee.status),
                            },
                            {
                                decision: "cancel" as const,
                                label: "Cancel",
                                visible: !["cancelled", "declined"].includes(props.attendee.status),
                            },
                        ].filter((action) => action.visible)}
                    >
                        {(action) => (
                            <button
                                class="button"
                                disabled={props.isPending}
                                onClick={() =>
                                    props.perform(async () => {
                                        const client = await memberClient();
                                        const preview = await client.query(
                                            api.events.registrations.previewDecision,
                                            { id: props.attendee._id, decision: action.decision },
                                        );
                                        if (
                                            !(await confirm({
                                                title:
                                                    action.decision === "cancel"
                                                        ? "Cancel registration"
                                                        : action.label,
                                                action: action.label,
                                                description: `Update ${preview.name}’s registration to ${preview.status === "going" ? "confirmed" : preview.status === "pending" ? "pending approval" : preview.status === "waitlist" ? "waitlisted" : preview.status}.`,
                                                isDestructive: [
                                                    "cancel",
                                                    "decline",
                                                    "rescind",
                                                ].includes(action.decision),
                                                emails: preview.emails,
                                                recipients: preview.recipients,
                                                details: [
                                                    preview.promotions
                                                        ? `${preview.promotions} waitlist registrations will be confirmed.`
                                                        : "",
                                                    preview.outcome
                                                        ? `The event will also be ${preview.outcome}.`
                                                        : "",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" "),
                                            }))
                                        )
                                            return false;
                                        await client.mutation(api.events.registrations.decide, {
                                            receipt: preview.receipt,
                                            id: props.attendee._id,
                                            decision: action.decision,
                                        });
                                    }, "Registration updated.")
                                }
                            >
                                {action.label}
                            </button>
                        )}
                    </For>
                </div>
            </td>
        </tr>
    );
}

/** Read one native attendee question label. */
function questionLabel(policy: Registration, index: number) {
    return policy.kind === "native" ? policy.questions[index]?.label : "Answer";
}
