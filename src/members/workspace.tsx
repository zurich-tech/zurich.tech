import { useConfirmation } from "../components/dialog";
import { Card } from "../components/card";
import { For, Show, createResource } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useWorkspaceCommand } from "../app/workspace";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Preview and pause the weekly newsletter. */
export function NewsletterAdmin() {
    const confirm = useConfirmation();
    const [edition, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.mail.digests.preview, {}),
    );
    const command = useWorkspaceCommand(refetch);

    /** Save the team’s scheduling preference. */
    function setPaused(event: Event & { currentTarget: HTMLInputElement }) {
        const isPaused = event.currentTarget.checked;
        event.currentTarget.checked = edition()?.isPaused ?? false;

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
                    checked={edition()?.isPaused ?? false}
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
