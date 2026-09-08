import { Card } from "../component/card";
import { Arrow } from "../component/arrow";
import { useSearchParams } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { publicClient } from "../core/convex";
import { Page } from "../component/page";
import { Seo } from "../component/seo";
import { FormMessage } from "../component/form";
import { errorMessage } from "../core/error";

/** Unsubscribe without allowing email scanners to change subscriptions. */
export default function Route() {
    // retain the unsubscribe result for this private link
    const [params] = useSearchParams();
    const [success, setSuccess] = createSignal<string>();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Confirm the recipient's request to stop the weekly digest. */
    async function unsubscribe() {
        setIsPending(true);
        setError(undefined);
        try {
            if (typeof params.token !== "string")
                throw new Error("This link is missing its unsubscribe token.");
            await publicClient().mutation(api.registration.unsubscribe, { token: params.token });
            setSuccess("You’re unsubscribed.");
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
                        <Show when={!success() && typeof params.token === "string"}>
                            <p>
                                Stop receiving the weekly programme. Your event registrations are
                                unaffected.
                            </p>
                            <button class="button" disabled={isPending()} onClick={unsubscribe}>
                                {isPending() ? "Unsubscribing…" : "Unsubscribe me"}
                            </button>
                        </Show>
                        <Show when={!params.token}>
                            <p>Open the unsubscribe link from your email.</p>
                        </Show>
                        <FormMessage error={error()} success={success()} />
                        <a href="/">
                            Back to events <Arrow direction="external" />
                        </a>
                    </div>
                </Card>
            </Page>
        </>
    );
}
