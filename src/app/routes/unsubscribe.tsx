import { Card } from "../../components/card";
import { Arrow } from "../../components/arrow";
import { useSearchParams } from "@solidjs/router";
import { createSignal, createResource, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import { publicClient } from "../../auth/convex";
import { Page } from "../page";
import { Seo } from "../seo";
import { FormMessage } from "../../components/form";
import { errorMessage } from "../../components/errors";

/** Unsubscribe without allowing email scanners to change subscriptions. */
export default function Route() {
    // retain the unsubscribe result for this private link
    const [params] = useSearchParams();
    const [subscription, { refetch }] = createResource(
        () => (typeof params.token === "string" ? params.token : undefined),
        async (token) => publicClient().query(api.mail.subscriptions.status, { token }),
    );
    const [success, setSuccess] = createSignal<string>();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Confirm the recipient's request to stop optional event emails. */
    async function unsubscribe() {
        setIsPending(true);
        setError(undefined);
        try {
            if (typeof params.token !== "string")
                throw new Error("This link is missing its unsubscribe token.");
            await publicClient().mutation(api.mail.subscriptions.unsubscribe, {
                token: params.token,
            });
            await refetch();
            setSuccess("Unsubscribed.");
        } catch (caught) {
            setError(errorMessage(caught, "Could not unsubscribe."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo
                title="Unsubscribe"
                description="Manage your zurich.tech newsletter subscription."
            />
            <Page width="narrow">
                <Card title="Unsubscribe" heading="h1">
                    <div class="confirmation-panel">
                        <Show
                            when={
                                !success() &&
                                subscription()?.isSubscribed &&
                                !subscription.loading &&
                                !subscription.error
                            }
                        >
                            <p>Stop weekly digests and new event emails.</p>
                            <button class="button" disabled={isPending()} onClick={unsubscribe}>
                                {isPending() ? "Unsubscribing…" : "Unsubscribe"}
                            </button>
                        </Show>
                        <Show when={!params.token}>
                            <p>Open the unsubscribe link from your email.</p>
                        </Show>
                        <Show when={subscription.loading}>
                            <p role="status">Loading…</p>
                        </Show>
                        <Show when={!success() && subscription() && !subscription()!.isSubscribed}>
                            <p>Unsubscribed.</p>
                        </Show>
                        <FormMessage
                            error={
                                error() ||
                                (subscription.error
                                    ? errorMessage(
                                          subscription.error,
                                          "Could not load subscription.",
                                      )
                                    : undefined)
                            }
                            success={success()}
                        />
                        <a href="/events">
                            Back to events <Arrow direction="external" />
                        </a>
                    </div>
                </Card>
            </Page>
        </>
    );
}
