import { For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useWorkspaceCommand, type Perform, type EventWorkspace } from "../app/workspace";
import { FormMessage } from "../components/form";
import { Card } from "../components/card";
import { Arrow } from "../components/arrow";
import { timeZone } from "../app/site";

/** Manage published events and their editable revisions. */
export function EventAdmin(props: {
    /** Visible events and publishing permissions. */
    workspace: EventWorkspace;
    /** Reload the event catalogue after a change. */
    refresh: () => unknown;
}) {
    const command = useWorkspaceCommand(props.refresh);

    return (
        <>
            <FormMessage error={command.error()} success={command.success()} />
            <div class="workspace-list">
                <For each={props.workspace.published}>
                    {(item) => (
                        <PublishedEventCard
                            event={item}
                            isPending={command.isPending()}
                            perform={command.perform}
                        />
                    )}
                </For>
                <For each={props.workspace.submissions}>
                    {(item) => (
                        <SubmissionCard
                            submission={item}
                            viewer={props.workspace.viewer}
                            isPending={command.isPending()}
                            perform={command.perform}
                        />
                    )}
                </For>
            </div>
            <Show when={!props.workspace.published.length && !props.workspace.submissions.length}>
                <p>No events yet.</p>
                <a class="text-link" href="/submit">
                    Create an event <Arrow direction="external" />
                </a>
            </Show>
        </>
    );
}

/** Show actions for a published event without an editable revision. */
function PublishedEventCard(props: {
    /** Published event being managed. */
    event: EventWorkspace["published"][number];
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
    /** Run a command and refresh its visible result. */
    perform: Perform;
}) {
    return (
        <Card title={props.event.title} meta={props.event.status}>
            <div class="row-actions">
                <button
                    disabled={props.isPending}
                    onClick={() =>
                        props.perform(async () => {
                            const id = await (
                                await memberClient()
                            ).mutation(api.events.mutations.edit, {
                                eventId: props.event._id,
                            });
                            window.location.assign(`/submit?edit=${id}`);
                        }, "Opened event editor.")
                    }
                >
                    Edit
                </button>
                <a href={`/events/${props.event.slug}`}>View</a>
                <a href={`/admin?event=${props.event._id}`}>Attendees</a>
            </div>
        </Card>
    );
}

/** Show the review state and actions for one event submission. */
function SubmissionCard(props: {
    /** Editable event revision. */
    submission: EventWorkspace["submissions"][number];
    /** Current publishing permissions. */
    viewer: EventWorkspace["viewer"];
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
    /** Run a command and refresh its visible result. */
    perform: Perform;
}) {
    return (
        <Card
            title={props.submission.title}
            meta={`${props.submission.status} · ${new Date(props.submission.startsAt).toLocaleDateString("en-GB", { timeZone })}`}
        >
            <Show when={props.submission.reviewNote}>
                <p>{props.submission.reviewNote}</p>
            </Show>
            <div class="row-actions">
                <a href={`/submit?edit=${props.submission._id}`}>Edit</a>
                <a href={`/submit?duplicate=${props.submission._id}`}>Duplicate</a>
                <Show when={props.submission.eventId}>
                    <a href={`/events/${props.submission.slug}`}>
                        View <Arrow direction="external" />
                    </a>
                    <a href={`/admin?event=${props.submission.eventId}`}>Attendees</a>
                </Show>
                <Show when={props.submission.status !== "published" && props.viewer.canPublish}>
                    <button
                        disabled={props.isPending}
                        onClick={() =>
                            props.perform(
                                async () =>
                                    await (
                                        await memberClient()
                                    ).mutation(api.events.mutations.publish, {
                                        id: props.submission._id,
                                    }),
                                "Event published.",
                            )
                        }
                    >
                        Publish
                    </button>
                </Show>
                <Show when={props.viewer.isTeam && props.submission.status === "review"}>
                    <button
                        disabled={props.isPending}
                        onClick={() => {
                            const note = window.prompt("What needs to change before publication?");
                            if (note)
                                void props.perform(
                                    async () =>
                                        await (
                                            await memberClient()
                                        ).mutation(api.events.mutations.decline, {
                                            id: props.submission._id,
                                            note,
                                        }),
                                    "Feedback sent to the workspace.",
                                );
                        }}
                    >
                        Return for changes
                    </button>
                </Show>
            </div>
        </Card>
    );
}
