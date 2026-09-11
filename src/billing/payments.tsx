import { createResource, createSignal, For, Show } from "solid-js";
import type { FunctionArgs } from "convex/server";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { useAccount } from "../auth/index";
import { errorMessage } from "../components/errors";

/** Open Stripe for an owned purchase, preserving the destination across sign-in. */
export function CheckoutButton(props: {
    /** Annual entitlement. */ purchase: FunctionArgs<typeof api.billing.stripe.start>["purchase"];
    /** Button label. */ label: string;
}) {
    const account = useAccount();
    const [isPending, setIsPending] = createSignal(false);
    const [error, setError] = createSignal<string>();

    /** Create or resume the server-priced checkout. */
    async function start() {
        // require sign in while preserving the selected purchase page
        if (!account.user()) {
            window.location.assign(
                `/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
            );

            return;
        }
        setIsPending(true);
        setError(undefined);
        try {
            const url = await (
                await memberClient()
            ).action(api.billing.stripe.start, { purchase: props.purchase });
            window.location.assign(url);
        } catch (caught) {
            setError(errorMessage(caught, "Could not open payment."));
            setIsPending(false);
        }
    }

    return (
        <div class="checkout-action">
            <button class="button button--primary" disabled={isPending()} onClick={start}>
                {isPending() ? "Opening payment…" : props.label}
            </button>
            <Show when={error()}>
                <p class="form-error">{error()}</p>
            </Show>
        </div>
    );
}

/** List paid annual terms and their Stripe invoices for the current account. */
export function PaymentHistory() {
    const [payments] = createResource(async () =>
        (await memberClient()).query(api.billing.payments.history, {}),
    );

    return (
        <div class="payment-history">
            <Show when={payments.error}>
                <p class="form-error">{errorMessage(payments.error, "Could not load payments.")}</p>
            </Show>
            <Show when={payments()}>
                {(rows) => (
                    <Show when={rows().length} fallback={<p>No payments yet.</p>}>
                        <For each={rows()}>
                            {(payment) => (
                                <article class="payment-row">
                                    <div>
                                        <strong>{payment.name}</strong>
                                        <p>
                                            {new Date(payment.date).toLocaleDateString("en-GB")} ·
                                            CHF {payment.amount.toLocaleString("de-CH")} ·{" "}
                                            {payment.status}
                                        </p>
                                    </div>
                                    <Show when={payment.invoiceUrl}>
                                        <a
                                            class="text-link"
                                            href={payment.invoiceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Invoice
                                        </a>
                                    </Show>
                                </article>
                            )}
                        </For>
                    </Show>
                )}
            </Show>
        </div>
    );
}
