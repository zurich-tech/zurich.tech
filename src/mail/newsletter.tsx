import { Alert } from "../components/alert";
import { useAccount } from "../auth";
import { memberClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import { startTransition, createSignal, createResource, Show } from "solid-js";
import { subscribe } from "../events/registration";
import { errorMessage } from "../components/errors";
import { FormMessage } from "../components/form";
import { ArrowRight, LoaderCircle } from "lucide-solid";

/** Subscribe to the weekly email from a compact inline form. */
export function Newsletter(props: {
    /** Hide the signup prompt once the member subscribes to weekly emails. */
    hideWhenSubscribed?: boolean;
}) {
    const account = useAccount();
    const [preferences, { refetch }] = createResource(
        () => account.user()?.id,
        async () => (await memberClient()).query(api.mail.preferences.current, {}),
    );
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();

    /** Subscribe the signed-in member without requesting their email again. */
    async function subscribeMember() {
        const current = preferences();
        if (!current || current.isSuppressed) return;
        setIsPending(true);
        setError(undefined);
        try {
            await (
                await memberClient()
            ).action(api.mail.preferences.save, {
                weekly: true,
                announcements: true,
                reminders: true,
                followUps: true,
            });
            await startTransition(refetch);
        } catch (caught) {
            setError(errorMessage(caught, "Could not subscribe."));
        } finally {
            setIsPending(false);
        }
    }

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
        <Show
            when={
                !props.hideWhenSubscribed ||
                (!account.isPending() &&
                    preferences.state !== "pending" &&
                    (!account.user() || preferences.error || !preferences()?.weekly))
            }
        >
            <section class="newsletter" id="newsletter" aria-labelledby="newsletter-title">
                {/* heading */}
                <h2 id="newsletter-title">Every Monday</h2>
                <p class="newsletter-description">Events, news and jobs in Zurich tech.</p>
                <Show
                    when={!account.isPending() && preferences.state !== "pending"}
                    fallback={<p role="status">Loading…</p>}
                >
                    <Show
                        when={!account.user()}
                        fallback={
                            <div class="newsletter-member">
                                <div class="newsletter-actions">
                                    <Show
                                        when={preferences.error}
                                        fallback={
                                            <span class="newsletter-status">
                                                {preferences()?.isSuppressed
                                                    ? "Delivery blocked"
                                                    : preferences()?.weekly
                                                      ? "Subscribed"
                                                      : "Not subscribed"}
                                            </span>
                                        }
                                    >
                                        <p class="form-error">
                                            {errorMessage(
                                                preferences.error,
                                                "Could not load subscription.",
                                            )}
                                        </p>
                                    </Show>
                                    <Show
                                        when={
                                            preferences() &&
                                            !preferences()!.weekly &&
                                            !preferences()!.isSuppressed &&
                                            !preferences.error
                                        }
                                    >
                                        <button
                                            class="button button--primary"
                                            disabled={isPending()}
                                            onClick={subscribeMember}
                                        >
                                            {isPending() ? "Subscribing…" : "Subscribe"}
                                        </button>
                                    </Show>
                                    <a class="action-link" href="/settings?section=notifications">
                                        Email settings
                                    </a>
                                </div>
                                <Show
                                    when={
                                        preferences()?.isTestMode &&
                                        preferences()?.weekly &&
                                        !preferences()?.isSuppressed
                                    }
                                >
                                    <Alert tone="warning" title="Test mode">
                                        You’re subscribed. Delivery will start once Test mode is
                                        off.
                                    </Alert>
                                </Show>
                                <FormMessage error={error()} />
                            </div>
                        }
                    >
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
                                <button
                                    type="submit"
                                    disabled={isPending()}
                                    aria-label={isPending() ? "Subscribing" : "Subscribe"}
                                    aria-busy={isPending()}
                                    title="Subscribe"
                                >
                                    <Show
                                        when={isPending()}
                                        fallback={<ArrowRight size={18} aria-hidden="true" />}
                                    >
                                        <LoaderCircle size={18} aria-hidden="true" />
                                    </Show>
                                </button>
                            </div>
                            <FormMessage error={error()} success={success()} />
                        </form>
                    </Show>
                </Show>
            </section>
        </Show>
    );
}
