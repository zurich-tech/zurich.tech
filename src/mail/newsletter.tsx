import { Card } from "../components/card";
import { createSignal } from "solid-js";
import { subscribe } from "../events/registration";
import { errorMessage } from "../components/errors";
import { FormMessage } from "../components/form";

/** Subscribe to the weekly event list from a compact inline form. */
export function Newsletter() {
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();

    /** Request email verification before activating the subscription. */
    async function submit(event: SubmitEvent) {
        // read the recipient before requesting confirmation
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const email = String(new FormData(form).get("email"));
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await subscribe(email);
            setSuccess("Check your inbox to confirm.");
            form.reset();
        } catch (caught) {
            setError(errorMessage(caught, "Could not subscribe."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <Card title="Newsletter" class="newsletter newsletter-compact" id="newsletter">
            <form onSubmit={submit}>
                <div class="newsletter-input">
                    <input
                        aria-label="Email for weekly events"
                        type="email"
                        name="email"
                        placeholder="Email address"
                        required
                        maxlength="254"
                    />
                    <button disabled={isPending()}>{isPending() ? "Sending…" : "Subscribe"}</button>
                </div>
                <FormMessage error={error()} success={success()} />
            </form>
        </Card>
    );
}
