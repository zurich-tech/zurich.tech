import { useSearchParams } from "@solidjs/router";
import { startTransition, createSignal, createResource, createEffect, Show } from "solid-js";
import { parseScope } from "../../../convex/mail/consent";
import { api } from "../../../convex/_generated/api";
import { publicClient } from "../../auth/convex";
import { Page } from "../page";
import { Seo } from "../seo";
import { FormMessage } from "../../components/form";
import { errorMessage } from "../../components/errors";
import { EmailPreferences, emailChoice } from "../../mail/preferences";

/** Stop one category or explicitly edit preferences through a private email link. */
export default function Route() {
    const [params, setParams] = useSearchParams();
    const [subscription, { refetch }] = createResource(
        () => (typeof params.token === "string" ? params.token : undefined),
        async (token) => ({
            token,
            preferences: await publicClient().query(api.mail.preferences.read, { token }),
        }),
    );
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    const [isRequested, setIsRequested] = createSignal(false);
    const scope = () => parseScope(params.scope);
    const choice = () => (scope() ? emailChoice(scope()!) : undefined);
    const isEditor = () => params.view === "preferences" || !params.scope;
    const current = () =>
        subscription.error || subscription()?.token !== params.token
            ? undefined
            : subscription()?.preferences;
    const isStopped = () =>
        current() &&
        (choice()
            ? !current()![choice()!.key]
            : ![
                  current()!.weekly,
                  current()!.announcements,
                  current()!.reminders,
                  current()!.followUps,
              ].some(Boolean));
    const label = () =>
        scope() === "weekly"
            ? "the newsletter"
            : scope() === "announcement"
              ? "new event emails"
              : (choice()?.label.toLowerCase() ?? "all optional emails");

    // clear feedback when the recipient or requested action changes
    createEffect(() => {
        params.token;
        params.scope;
        params.view;
        setError(undefined);
        setIsRequested(false);
    });

    /** Confirm the requested opt-out without altering unrelated choices. */
    async function unsubscribe() {
        if (typeof params.token !== "string" || !scope()) return;
        setIsPending(true);
        setError(undefined);
        try {
            await publicClient().mutation(api.mail.subscriptions.unsubscribe, {
                token: params.token,
                scope: scope()!,
            });
            await startTransition(refetch);
        } catch (caught) {
            setError(errorMessage(caught, "Could not unsubscribe. Please try again."));
        } finally {
            setIsPending(false);
        }
    }

    /** Recover access without exposing whether an address exists. */
    async function request(event: SubmitEvent) {
        event.preventDefault();
        const email = String(new FormData(event.currentTarget as HTMLFormElement).get("email"));
        setIsPending(true);
        setError(undefined);
        try {
            await publicClient().action(api.mail.preferences.request, { email });
            setIsRequested(true);
        } catch (caught) {
            setError(errorMessage(caught, "Could not request a link. Please try again."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo
                title="Email preferences"
                description="Choose which zurich.tech emails you receive."
            />
            <Page class="publication" width="narrow">
                <section class="mail-unsubscribe">
                    <Show when={subscription.loading}>
                        <p role="status">Loading…</p>
                    </Show>
                    <Show when={current()}>
                        {(value) => (
                            <Show
                                when={isEditor() || value().isSuppressed}
                                fallback={
                                    <>
                                        <Show
                                            when={scope()}
                                            fallback={
                                                <>
                                                    <h1>Invalid email link</h1>
                                                    <p>Manage your preferences below instead.</p>
                                                </>
                                            }
                                        >
                                            <h1>
                                                {isStopped()
                                                    ? `You're unsubscribed from ${label()}.`
                                                    : `Unsubscribe from ${label()}?`}
                                            </h1>
                                            <p>
                                                {scope() === "all"
                                                    ? "Registration confirmations and important booking changes will still reach you."
                                                    : isStopped()
                                                      ? "Your other email preferences are unchanged."
                                                      : "Your other email preferences won’t change."}
                                            </p>
                                            <Show when={!isStopped()}>
                                                <button
                                                    class="button button--primary"
                                                    disabled={isPending()}
                                                    onClick={unsubscribe}
                                                >
                                                    {isPending() ? "Unsubscribing…" : "Unsubscribe"}
                                                </button>
                                            </Show>
                                        </Show>
                                        <button
                                            class="text-link"
                                            onClick={() => setParams({ view: "preferences" })}
                                        >
                                            Manage email preferences
                                        </button>
                                    </>
                                }
                            >
                                <h1>Email preferences</h1>
                                <EmailPreferences
                                    value={value()}
                                    isSuppressed={value().isSuppressed}
                                    onSave={async (choices) => {
                                        await publicClient().mutation(
                                            api.mail.preferences.saveLink,
                                            { token: String(params.token), ...choices },
                                        );
                                        await startTransition(refetch);
                                    }}
                                />
                            </Show>
                        )}
                    </Show>
                    <Show when={!subscription.loading && !subscription.error && !current()}>
                        <h1>Email preferences</h1>
                        <p>
                            {params.token
                                ? "This email link is invalid. Request a new link below."
                                : "Enter your email to receive a private preferences link."}
                        </p>
                        <Show
                            when={!isRequested()}
                            fallback={
                                <p role="status">
                                    If this address receives our emails, a preferences link is on
                                    its way.
                                </p>
                            }
                        >
                            <form class="editor mail-preferences" onSubmit={request}>
                                <label>
                                    Email address
                                    <input
                                        type="email"
                                        name="email"
                                        autocomplete="email"
                                        required
                                        disabled={isPending()}
                                        maxlength="254"
                                    />
                                </label>
                                <div>
                                    <button class="button button--primary" disabled={isPending()}>
                                        {isPending() ? "Sending…" : "Send preferences link"}
                                    </button>
                                </div>
                            </form>
                        </Show>
                    </Show>
                    <Show when={subscription.error}>
                        <h1>Email preferences</h1>
                    </Show>
                    <FormMessage
                        error={
                            error() ||
                            (subscription.error
                                ? errorMessage(
                                      subscription.error,
                                      "Could not load email preferences.",
                                  )
                                : undefined)
                        }
                    />
                    <Show when={subscription.error}>
                        <button class="text-link" onClick={() => void refetch()}>
                            Try again
                        </button>
                    </Show>
                </section>
            </Page>
        </>
    );
}
