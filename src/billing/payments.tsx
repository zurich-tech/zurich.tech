import { createResource, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import { site } from "../app/site";
import { errorMessage } from "../components/errors";

/** Request an invoice from the team for a saved job or sponsorship. */
export function InvoiceButton(props: {
    /** Purchase identified in the invoice request. */
    name: string;
    /** Saved record the team should review. */
    reference: string;
}) {
    const subject = () => encodeURIComponent(`Invoice request: ${props.name}`);
    const body = () =>
        encodeURIComponent(`Please invoice me for ${props.name}.\n\nReference: ${props.reference}`);
    return (
        <a
            class="button button--primary"
            href={`mailto:${site.email}?subject=${subject()}&body=${body()}`}
        >
            Request invoice
        </a>
    );
}

/** List payments and available invoices for the current account. */
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
