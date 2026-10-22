import { useConfirmation } from "../components/dialog";
import { useAccess } from "../auth/edit";
import { FilterPills } from "../components/filter-pills";
import { DataGrid } from "../components/grid";
import { Loading } from "../components/loading";
import { Card } from "../components/card";
import { For, Show, createSignal, createResource } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useWorkspaceCommand, type Perform, type AttendeeList } from "../app/workspace";
import { FormMessage } from "../components/form";
import type { Id } from "../../convex/_generated/dataModel";
import type { Registration } from "../../convex/events/fields";
import { errorMessage } from "../components/errors";

/** Display names shared by table cells, search and exports. */
const registrationLabels = {
    going: "Confirmed",
    pending: "Pending",
    waitlist: "Waitlisted",
    declined: "Declined",
    cancelled: "Cancelled",
};

/** Load and manage attendance for one selected event. */
export function Attendees(props: {
    /** Event selected through the workspace URL. */
    eventId: string;
}) {
    const access = useAccess();
    const [attendees, { refetch }] = createResource(
        () => (access.key() ? { key: access.key(), eventId: props.eventId } : undefined),
        async ({ key, eventId }) => ({
            key,
            eventId,
            value: await (
                await memberClient()
            ).query(api.events.registrations.list, {
                eventId: eventId as Id<"events">,
            }),
        }),
    );
    const list = () =>
        attendees()?.key === access.key() && attendees()?.eventId === props.eventId
            ? attendees()?.value
            : undefined;
    const command = useWorkspaceCommand(refetch);

    return (
        <>
            <Show when={attendees.error}>
                <p class="form-error">
                    {errorMessage(attendees.error, "Could not load attendees.")}
                </p>
                <button class="button" onClick={() => void refetch()} disabled={attendees.loading}>
                    Retry
                </button>
            </Show>
            <FormMessage error={command.error()} success={command.success()} />
            <Show
                when={list()}
                fallback={
                    <Show when={!attendees.error}>
                        <Loading />
                    </Show>
                }
            >
                {(list) => (
                    <AttendeeTable
                        list={list()}
                        onRefresh={() => void refetch()}
                        isPending={command.isPending()}
                        perform={command.perform}
                    />
                )}
            </Show>
        </>
    );
}

/** Show the selected event’s attendees and registration controls. */
function AttendeeTable(props: {
    /** Event and attendee records. */
    list: AttendeeList;
    /** Reload registrations after changes made elsewhere. */
    onRefresh: () => void;
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
    /** Run a command and refresh its visible result. */
    perform: Perform;
}) {
    const [status, setStatus] = createSignal("all");
    const hasAnswers = () => props.list.rows.some((row) => row.answers?.some(Boolean));
    const rows = () =>
        props.list.rows.filter((row) => status() === "all" || row.status === status());

    return (
        <Card
            title="Registrations"
            class="registration-grid"
            toolbar={
                <div class="admin-attendee-actions">
                    <a class="action-link" href="/admin">
                        Back
                    </a>
                    <Show when={props.list.event.checkIn?.isEnabled}>
                        <a class="action-link" href={`/checkin?event=${props.list.event._id}`}>
                            Check in
                        </a>
                    </Show>
                    <a class="action-link" href={`/feedback?event=${props.list.event._id}`}>
                        Feedback
                    </a>
                    <button class="button" disabled={props.isPending} onClick={props.onRefresh}>
                        Refresh
                    </button>
                </div>
            }
        >
            <div class="admin-context">
                <a href={`/events/${props.list.event.slug}`}>{props.list.event.title}</a>
            </div>
            <Show when={props.list.rows.length > 0}>
                <div class="admin-filters">
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
                        ].map((option) => ({
                            ...option,
                            label: `${option.label} (${option.value === "all" ? props.list.rows.length : props.list.rows.filter((row) => row.status === option.value).length})`,
                        }))}
                    />
                </div>
            </Show>
            <DataGrid
                rows={rows()}
                label="Registrations"
                filename={`${props.list.event.slug}-registrations.csv`}
                initialSort="created"
                columns={[
                    {
                        id: "name",
                        label: "Name",
                        value: (row) => row.name,
                    },
                    { id: "email", label: "Email", value: (row) => row.email },
                    {
                        id: "status",
                        label: "Status",
                        value: (row) => registrationLabels[row.status],
                    },
                    {
                        id: "created",
                        label: "Registered",
                        value: (row) => row.createdAt,
                        exportValue: (row) => new Date(row.createdAt).toISOString(),
                    },
                    {
                        id: "updated",
                        label: "Updated",
                        value: (row) => row.updatedAt,
                        exportValue: (row) => new Date(row.updatedAt).toISOString(),
                    },
                    ...(hasAnswers()
                        ? [
                              {
                                  id: "answers",
                                  label: "Answers",
                                  value: (row: AttendeeList["rows"][number]) =>
                                      (row.answers ?? []).join(" | "),
                              },
                          ]
                        : []),
                    {
                        id: "actions",
                        label: "Actions",
                        value: () => "",
                        isSortable: false,
                        exportValue: false,
                    },
                ]}
                row={(row) => (
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
            />
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
    const access = useAccess();
    const confirm = useConfirmation();
    return (
        <tr>
            <td>{props.attendee.name}</td>
            <td>{props.attendee.email}</td>
            <td>{registrationLabels[props.attendee.status]}</td>
            <td>
                <time dateTime={new Date(props.attendee.createdAt).toISOString()}>
                    {new Date(props.attendee.createdAt).toLocaleDateString("en-GB")}
                </time>
            </td>
            <td>
                <time dateTime={new Date(props.attendee.updatedAt).toISOString()}>
                    {new Date(props.attendee.updatedAt).toLocaleDateString("en-GB")}
                </time>
            </td>
            <Show when={props.hasAnswers}>
                <td>
                    <details>
                        <summary>View answers</summary>
                        <For each={props.attendee.answers}>
                            {(answer, index) => (
                                <p>
                                    <strong>{questionLabel(props.policy, index())}</strong>
                                    <br />
                                    {answer}
                                </p>
                            )}
                        </For>
                    </details>
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
                                disabled={props.isPending || !access.current()?.canSendMail}
                                title={
                                    !access.current()?.canSendMail
                                        ? "This sends a registration email; email sending permission required"
                                        : undefined
                                }
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
