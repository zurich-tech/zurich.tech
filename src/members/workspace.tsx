import { Card } from "../components/card";
import { For, Show, createResource } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useWorkspaceCommand, type EventWorkspace } from "../app/workspace";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Manage team access for signed-in accounts. */
export function Team(props: {
    /** Accounts visible to the team. */
    people: EventWorkspace["people"];
    /** Reload permissions after a change. */
    refresh: () => unknown;
}) {
    const command = useWorkspaceCommand(props.refresh);

    return (
        <Card title="Team">
            <FormMessage error={command.error()} success={command.success()} />
            <p>
                Team members can manage events and grant team access. Sign in once to appear here.
            </p>
            <div class="table-scroll">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Team access</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={props.people}>
                            {(person) => (
                                <tr>
                                    <td>{person.name}</td>
                                    <td>{person.email}</td>
                                    <td>
                                        <label class="checkbox">
                                            <input
                                                type="checkbox"
                                                aria-label={`Team access for ${person.name}`}
                                                checked={person.isTeam}
                                                disabled={command.isPending() || person.isSelf}
                                                onChange={(event) => {
                                                    const isTeam = event.currentTarget.checked;
                                                    void command.perform(
                                                        async () =>
                                                            await (
                                                                await memberClient()
                                                            ).mutation(api.auth.access.setTeam, {
                                                                id: person.id,
                                                                isTeam,
                                                            }),
                                                        "Team access updated.",
                                                    );
                                                }}
                                            />
                                        </label>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </Card>
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
        <Card title="Email">
            <label class="checkbox">
                <input
                    type="checkbox"
                    checked={props.isPaused}
                    disabled={command.isPending()}
                    onChange={setPaused}
                />
                Pause weekly newsletter
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
                        <p>{current().subscribers} subscribers</p>
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
        </Card>
    );
}
