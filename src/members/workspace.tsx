import { useConfirmation } from "../components/dialog";
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
    const confirm = useConfirmation();
    const command = useWorkspaceCommand(props.refresh);

    return (
        <Card title="Team" class="admin-table-card">
            <FormMessage error={command.error()} success={command.success()} />
            <p class="admin-context">Team members can manage events and team access.</p>
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
                                                    event.currentTarget.checked = person.isTeam;
                                                    void command.perform(async () => {
                                                        if (
                                                            !(await confirm({
                                                                title: isTeam
                                                                    ? "Grant team access"
                                                                    : "Revoke team access",
                                                                action: isTeam
                                                                    ? "Grant access"
                                                                    : "Revoke access",
                                                                description: isTeam
                                                                    ? `${person.name} will be able to manage events, send emails and change team access.`
                                                                    : `${person.name} will lose team permissions.`,
                                                                isDestructive: !isTeam,
                                                                emails: 0,
                                                            }))
                                                        )
                                                            return false;
                                                        await (
                                                            await memberClient()
                                                        ).mutation(api.auth.access.setTeam, {
                                                            id: person.id,
                                                            isTeam,
                                                        });
                                                    }, "Team access updated.");
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
    const confirm = useConfirmation();
    const [edition] = createResource(async () =>
        (await memberClient()).query(api.mail.digests.preview, {}),
    );
    const command = useWorkspaceCommand(props.refresh);

    /** Save the team’s scheduling preference. */
    function setPaused(event: Event & { currentTarget: HTMLInputElement }) {
        const isPaused = event.currentTarget.checked;
        event.currentTarget.checked = props.isPaused;

        void command.perform(async () => {
            const client = await memberClient();
            const preview = await client.query(api.mail.digests.preview, {});
            if (
                !(await confirm({
                    title: isPaused ? "Pause newsletter" : "Resume newsletter",
                    action: isPaused ? "Pause newsletter" : "Resume newsletter",
                    description: isPaused
                        ? "Stop scheduled weekly newsletters."
                        : `Enable Monday newsletters for ${preview.subscribers.toLocaleString("en-CH")} current subscribers.`,
                    emails: 0,
                    details: isPaused
                        ? "Already queued emails are unaffected."
                        : "Emails will be sent at the next scheduled delivery.",
                }))
            )
                return false;
            await client.mutation(api.mail.digests.pause, { isPaused });
        }, "Newsletter schedule updated.");
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
