import { createResource, createSignal, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

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
            });
            await refetch();
            setSuccess("Email preferences saved.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not save email preferences."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card title="Notifications" id="notifications">
            <Show when={preferences.error}>
                <p class="form-error">
                    {errorMessage(preferences.error, "Could not load email preferences.")}
                </p>
            </Show>
            <Show when={preferences()}>
                {(current) => (
                    <form class="editor" onSubmit={save}>
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
                        </fieldset>
                        <Show when={current().isSuppressed}>
                            <p class="form-error">Delivery blocked. Contact the team.</p>
                        </Show>
                        <button
                            class="button button--primary"
                            disabled={isPending() || current().isSuppressed}
                        >
                            {isPending() ? "Saving…" : "Save preferences"}
                        </button>
                        <FormMessage error={error()} success={success()} />
                    </form>
                )}
            </Show>
        </Card>
    );
}
