import { For, Show, createResource } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useWorkspaceCommand, type EventWorkspace } from "../app/workspace";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Manage the team’s trusted organisers. */
export function Organisers(props: {
    /** Accounts visible to the team. */
    people: EventWorkspace["people"];
    /** Reload permissions after a change. */
    refresh: () => unknown;
}) {
    const command = useWorkspaceCommand(props.refresh);

    return (
        <>
            <FormMessage error={command.error()} success={command.success()} />
            <h2>Trusted organisers</h2>
            <p>Publishing permission applies only to an organiser’s own events.</p>
            <div class="workspace-list">
                <For each={props.people}>
                    {(person) => (
                        <article>
                            <h3>{person.name}</h3>
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    checked={person.canPublish}
                                    disabled={command.isPending()}
                                    onChange={(event) => {
                                        const canPublish = event.currentTarget.checked;
                                        void command.perform(
                                            async () =>
                                                await (
                                                    await memberClient()
                                                ).mutation(api.auth.access.setPublishingAccess, {
                                                    id: person.id,
                                                    canPublish,
                                                }),
                                            "Publishing permission updated.",
                                        );
                                    }}
                                />
                                Can publish directly
                            </label>
                        </article>
                    )}
                </For>
            </div>
        </>
    );
}

/** Preview and pause the weekly newsletter. */
export function NewsletterAdmin(props: {
    /** Current scheduling preference. */
    isPaused: boolean;
    /** Reload scheduling state after a change. */
    refresh: () => unknown;
}) {
    const [edition] = createResource(async () =>
        (await memberClient()).query(api.mail.digests.preview, {}),
    );
    const command = useWorkspaceCommand(props.refresh);

    /** Save the team’s scheduling preference. */
    function setPaused(event: Event & { currentTarget: HTMLInputElement }) {
        const isPaused = event.currentTarget.checked;

        void command.perform(
            async () => (await memberClient()).mutation(api.mail.digests.pause, { isPaused }),
            "Newsletter schedule updated.",
        );
    }

    return (
        <>
            <h2>Weekly email</h2>
            <label class="checkbox">
                <input
                    type="checkbox"
                    checked={props.isPaused}
                    disabled={command.isPending()}
                    onChange={setPaused}
                />
                Pause automatic sending
            </label>
            <FormMessage error={command.error()} success={command.success()} />
            <Show when={edition.error}>
                <p class="form-error">
                    {errorMessage(edition.error, "Could not load the email preview.")}
                </p>
            </Show>
            <Show when={edition()}>
                {(current) => (
                    <>
                        <p>{current().subscribers} confirmed subscribers</p>
                        <iframe
                            class="email-preview"
                            title="Newsletter preview"
                            srcdoc={current().html}
                            sandbox=""
                        />
                        <For each={current().failures}>
                            {(failure) => (
                                <p class="form-error">
                                    {failure.subject} → {failure.to}: {failure.error}
                                </p>
                            )}
                        </For>
                    </>
                )}
            </Show>
        </>
    );
}
