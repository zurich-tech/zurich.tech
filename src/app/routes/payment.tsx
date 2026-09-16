import { FormMessage } from "../../components/form";
import { useSearchParams } from "@solidjs/router";
import { createResource, createEffect, onCleanup, Show, Switch, Match } from "solid-js";
import { api } from "../../../convex/_generated/api";
import { useAccount } from "../../auth/index";
import { memberClient } from "../../auth/convex";
import { Page } from "../page";
import { Card } from "../../components/card";
import { Seo } from "../seo";
import { errorMessage } from "../../components/errors";

/** Show the verified payment result and its invoice. */
export default function Route() {
    // load the signed in purchaser’s payment result
    const account = useAccount();
    const [params] = useSearchParams();
    const checkout = () =>
        account.user() && typeof params.session_id === "string"
            ? { accountId: account.user()!.id, sessionId: params.session_id }
            : undefined;
    const [payment, { refetch }] = createResource(checkout, async (request) => ({
        ...request,
        value: await (
            await memberClient()
        ).query(api.billing.checkouts.status, { sessionId: request.sessionId }),
    }));
    // keep polling results attached to their account and checkout
    const currentPayment = () => {
        if (payment.error || payment.state === "pending") return undefined;
        const result = payment.latest;
        return result?.accountId === account.user()?.id && result?.sessionId === params.session_id
            ? result?.value
            : undefined;
    };

    // refresh while Stripe's signed webhook is still arriving
    createEffect(() => {
        if (currentPayment()?.status !== "pending") return;
        const interval = setInterval(() => void refetch(), 2500);
        onCleanup(() => clearInterval(interval));
    });

    return (
        <>
            <Seo title="Payment" description="Your zurich.tech payment." />
            <Page width="narrow">
                <Card title="Payment" heading="h1">
                    <Switch fallback={<p>Open your payment confirmation to view its status.</p>}>
                        <Match
                            when={
                                account.isPending() ||
                                (!!checkout() && !payment.error && !currentPayment())
                            }
                        >
                            <p role="status">Loading…</p>
                        </Match>
                        <Match when={account.user() && payment.error}>
                            <FormMessage
                                error={errorMessage(payment.error, "Could not load payment.")}
                            />
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
                        <Match when={account.user() && currentPayment()}>
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
                                        <p>
                                            {current().publication &&
                                                {
                                                    published: "Listing published.",
                                                    closed: "Listing closed.",
                                                    expired: "Listing expired.",
                                                    unconfirmed:
                                                        "Confirm that you’re still hiring.",
                                                    draft: "Listing not submitted.",
                                                    review: "Listing in review.",
                                                }[current().publication!]}
                                        </p>
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
                                                current().isPersonal
                                                    ? "/settings"
                                                    : `/manage?section=${current().purchase.kind === "job" ? "jobs" : "sponsors"}`
                                            }
                                        >
                                            {current().isPersonal ? "Support settings" : "Manage"}
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
