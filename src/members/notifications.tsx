import { Alert } from "../components/alert";
import { startTransition, createResource, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { errorMessage } from "../components/errors";
import { EmailPreferences } from "../mail/preferences";

/** Edit the same email choices offered through private email links. */
export function Notifications() {
    const [preferences, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.mail.preferences.current, {}),
    );

    return (
        <Card title="Email preferences" id="notifications">
            <Show when={preferences.error}>
                <p class="form-error">
                    {errorMessage(preferences.error, "Could not load email preferences.")}
                </p>
            </Show>
            <Show when={preferences.loading}>
                <p role="status">Loading…</p>
            </Show>
            <Show when={!preferences.error && preferences()}>
                {(current) => (
                    <>
                        <EmailPreferences
                            value={current()}
                            isSuppressed={current().isSuppressed}
                            onSave={async (value) => {
                                await (
                                    await memberClient()
                                ).action(api.mail.preferences.save, value);
                                await startTransition(refetch);
                            }}
                        />
                        <Show when={current().isTestMode}>
                            <Alert tone="warning" title="Test mode">
                                Your preferences can be saved, but audience emails are off. Only
                                approved test addresses can receive other emails.
                            </Alert>
                        </Show>
                    </>
                )}
            </Show>
        </Card>
    );
}
