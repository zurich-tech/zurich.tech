import { Alert } from "../components/alert";
import { Suspense, startTransition, createResource, createSignal, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { savedEditor, Editor, FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";
import "./profile.css";

/** Edit email preferences. */
export function Notifications() {
    const [preferences, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.mail.preferences.current, {}),
    );
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();

    /** Save only the current account's verified email preferences. */
    async function save(event: SubmitEvent) {
        event.preventDefault();
        const editor = event.currentTarget as HTMLFormElement;
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await (
                await memberClient()
            ).action(api.mail.preferences.save, {
                weekly: fields.has("weekly"),
                announcements: fields.has("announcements"),
                reminders: fields.has("reminders"),
                followUps: fields.has("followUps"),
            });
            savedEditor(editor);
            await startTransition(refetch);
            setSuccess("Email preferences saved.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not save email preferences."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card
            title="Notifications"
            id="notifications"
            toolbar={
                <Suspense>
                    <Show when={preferences.latest}>
                        <button
                            type="submit"
                            form="notifications-editor"
                            class="button button--primary"
                            disabled={isPending() || preferences.latest?.isSuppressed}
                        >
                            {isPending() ? "Saving…" : "Save"}
                        </button>
                    </Show>
                </Suspense>
            }
        >
            <Show when={preferences.error}>
                <p class="form-error">
                    {errorMessage(preferences.error, "Could not load email preferences.")}
                </p>
            </Show>
            <Show when={preferences()}>
                {(current) => (
                    <Editor
                        id="notifications-editor"
                        class="editor"
                        onSubmit={save}
                        actions={() => (
                            <div class="form-actions">
                                <button
                                    class="button button--primary"
                                    disabled={isPending() || current().isSuppressed}
                                >
                                    {isPending() ? "Saving…" : "Save"}
                                </button>
                            </div>
                        )}
                    >
                        <fieldset
                            class="email-options"
                            disabled={isPending() || current().isSuppressed}
                        >
                            <label class="checkbox">
                                <input type="checkbox" name="weekly" checked={current().weekly} />
                                <span>
                                    Weekly digest
                                    <small>Every Monday.</small>
                                </span>
                            </label>
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    name="announcements"
                                    checked={current().announcements}
                                />
                                <span>
                                    New events
                                    <small>One email per new event.</small>
                                </span>
                            </label>
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    name="reminders"
                                    checked={current().reminders}
                                />
                                <span>
                                    Reminders
                                    <small>The day before your event.</small>
                                </span>
                            </label>
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    name="followUps"
                                    checked={current().followUps}
                                />
                                <span>
                                    Follow-up<small>Thank-you emails and feedback.</small>
                                </span>
                            </label>
                        </fieldset>
                        <Show when={current().isTestMode}>
                            <Alert tone="warning" title="Test mode">
                                Your preferences can be saved, but audience emails are off. Only
                                approved test addresses can receive other emails.
                            </Alert>
                        </Show>
                        <Show when={current().isSuppressed}>
                            <p class="form-error">Delivery blocked. Contact the team.</p>
                        </Show>

                        <FormMessage error={error()} success={success()} />
                    </Editor>
                )}
            </Show>
        </Card>
    );
}
