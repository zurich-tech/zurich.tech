import { useSearchParams } from "@solidjs/router";
import { createResource, createEffect, onCleanup, Show, Switch, Match } from "solid-js";
import { api } from "../../convex/_generated/api";
import { useAccount } from "../core/auth";
import { memberClient } from "../core/convex";
import { Page } from "../component/page";
import { Card } from "../component/card";
import { Seo } from "../component/seo";
import { errorMessage } from "../core/error";

/** Show the verified payment result and its invoice. */
export default function Route() {
    // load the signed in purchaser’s payment result
    const account = useAccount();
    const [params] = useSearchParams();
    const [payment, { refetch }] = createResource(
        () =>
            account.user() && typeof params.session_id === "string" ? params.session_id : undefined,
        async (sessionId) => (await memberClient()).query(api.checkout.status, { sessionId }),
    );

    // refresh while Stripe's signed webhook is still arriving
    createEffect(() => {
        if (payment()?.status !== "pending") return;
        const interval = setInterval(() => void refetch(), 2500);
        onCleanup(() => clearInterval(interval));
    });

    return (
        <>
            <Seo title="Payment" description="Your zurich.tech payment." />
            <Page width="narrow">
                <Card title="Payment" heading="h1">
                    <Switch fallback={<p>Open your payment confirmation to view its status.</p>}>
                        <Match when={payment.error}>
                            <p class="form-error">
                                {errorMessage(payment.error, "Could not load payment.")}
                            </p>
                            <button class="button" onClick={() => void refetch()}>
                                Refresh
                            </button>
                        </Match>
                        <Match when={!account.user() && params.session_id}>
                            <a
                                class="button"
                                href={`/sign-in?next=${encodeURIComponent(`/payment?session_id=${params.session_id}`)}`}
                            >
                                Sign in to view payment
                            </a>
                        </Match>
                        <Match when={payment()}>
                            {(current) => (
                                <>
                                    <p>
                                        {current().status === "paid"
                                            ? "Payment received. Thank you."
                                            : current().status === "refunded"
                                              ? "This payment has been refunded."
                                              : current().status === "expired"
                                                ? "This checkout has expired."
                                                : "Confirming your payment…"}
                                    </p>
                                    <Show
                                        when={
                                            current().status === "paid" &&
                                            current().purchase.kind === "job"
                                        }
                                    >
                                        <p>Your listing will appear once the team approves it.</p>
                                    </Show>
                                    <div class="row-actions">
                                        <Show when={current().invoiceUrl}>
                                            <a
                                                class="text-link"
                                                href={current().invoiceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                View invoice
                                            </a>
                                        </Show>
                                        <a
                                            class="button"
                                            href={
                                                current().purchase.kind === "patron"
                                                    ? "/settings"
                                                    : "/manage"
                                            }
                                        >
                                            {current().purchase.kind === "patron"
                                                ? "Patron settings"
                                                : "Your workspace"}
                                        </a>
                                    </div>
                                </>
                            )}
                        </Match>
                    </Switch>
                </Card>
            </Page>
        </>
    );
}
