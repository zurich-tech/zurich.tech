import { civilTime, timestamp } from "../../convex/events/time";
import "./editor.css";
import { For, Show, createSignal } from "solid-js";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import type { Perform } from "../app/workspace";
import { Editor, savedEditor } from "../components/form";
import { Card } from "../components/card";
import { tiers } from "../../convex/sponsorships/plans";

/** Company agreements and their invoice settlement history. */
type Workspace = FunctionReturnType<typeof api.organisations.workspace.employer>;
/** Retained agreement with its issued invoices. */
type Term = Workspace["sponsorships"][number]["history"][number];
/** Issued invoice and derived balance. */
type Invoice = Term["invoices"][number];

/** Read a date input as a calendar date. */
function day(fields: FormData, name: string) {
    return timestamp(`${fields.get(name)}T00:00`);
}
/** Format calendar dates consistently for inputs and history. */
function date(value: number) {
    return civilTime(value).slice(0, 10);
}
/** Read a required text field. */
function text(fields: FormData, name: string) {
    return String(fields.get(name) ?? "").trim();
}
/** Display amounts in the invoice currency. */
function money(amount: number) {
    return `CHF ${amount.toFixed(2)}`;
}

/** Submit one editor and clear its dirty state only after success. */
function submit(
    event: SubmitEvent,
    perform: Perform,
    operation: (fields: FormData) => Promise<unknown>,
    message: string,
) {
    event.preventDefault();
    const editor = event.currentTarget as HTMLFormElement;
    const fields = new FormData(editor);
    void perform(async () => {
        await operation(fields);
        savedEditor(editor);
    }, message);
}

/** Manage agreements independently of invoice payment. */
export function SponsorshipCard(props: {
    sponsor: Workspace["sponsorships"][number];
    companies: Workspace["organisations"];
    isAdmin: boolean;
    isPending: boolean;
    perform: Perform;
}) {
    const company = () =>
        props.companies.find((company) => company._id === props.sponsor.organisationId);
    return (
        <Card title={company()?.name ?? "Sponsorship"}>
            <p>
                {props.sponsor.term
                    ? `${props.sponsor.term.tier} sponsorship`
                    : `${props.sponsor.tier} sponsorship requested`}
            </p>
            <Show when={props.isAdmin}>
                <details>
                    <summary>Agree / renew sponsorship</summary>
                    <AgreementEditor
                        sponsorshipId={props.sponsor._id}
                        perform={props.perform}
                        isPending={props.isPending}
                    />
                </details>
            </Show>
            <For each={props.sponsor.history}>
                {(term) => (
                    <section class="sponsorship-history">
                        <header>
                            <h3>{tiers.find((tier) => tier.id === term.tier)?.name}</h3>
                            <span class="tag">
                                {term.supersededAt
                                    ? "Superseded"
                                    : term.endedAt !== undefined
                                      ? "Ended"
                                      : term.endsAt <= Date.now()
                                        ? "Expired"
                                        : term.startsAt > Date.now()
                                          ? "Upcoming"
                                          : "Current"}
                            </span>
                        </header>
                        <p>
                            {date(term.startsAt)} – {date(term.endsAt - 1)} ·{" "}
                            {term.contribution.kind === "money"
                                ? money(term.contribution.amount)
                                : term.contribution.description}
                        </p>
                        <p class="text-soft">
                            {term.publishedAt !== undefined
                                ? `Public recognition from ${date(term.publishedAt)}`
                                : "Not published"}
                        </p>
                        <p class="text-soft">
                            {term.reason} · {term.recordedByName} · {date(term.createdAt)}
                        </p>
                        <Show when={term.endedAt !== undefined}>
                            <p>
                                Ended {date(term.endedAt!)}: {term.endReason}
                            </p>
                        </Show>
                        <Show
                            when={props.isAdmin && !term.supersededAt && term.endedAt === undefined}
                        >
                            <details>
                                <summary>Amend / publish agreement</summary>
                                <AgreementEditor
                                    sponsorshipId={props.sponsor._id}
                                    term={term}
                                    perform={props.perform}
                                    isPending={props.isPending}
                                />
                            </details>
                            <details>
                                <summary>End agreement</summary>
                                <Editor
                                    class="editor"
                                    onSubmit={(event) =>
                                        submit(
                                            event,
                                            props.perform,
                                            async (fields) =>
                                                (await memberClient()).mutation(
                                                    api.sponsorships.terms.end,
                                                    {
                                                        id: term._id,
                                                        endedAt: day(fields, "endedAt"),
                                                        reason: text(fields, "reason"),
                                                    },
                                                ),
                                            "Agreement ended.",
                                        )
                                    }
                                >
                                    <label>
                                        End date
                                        <input
                                            name="endedAt"
                                            type="date"
                                            value={date(Date.now())}
                                            required
                                        />
                                    </label>
                                    <label>
                                        Reason
                                        <input name="reason" required />
                                    </label>
                                    <button class="button" disabled={props.isPending}>
                                        End agreement
                                    </button>
                                </Editor>
                            </details>
                        </Show>
                        <For each={term.invoices}>
                            {(invoice) => (
                                <InvoiceCard
                                    invoice={invoice}
                                    isAdmin={props.isAdmin}
                                    isPending={props.isPending}
                                    perform={props.perform}
                                />
                            )}
                        </For>
                        <Show
                            when={
                                props.isAdmin &&
                                term.contribution.kind === "money" &&
                                !term.supersededAt
                            }
                        >
                            <details>
                                <summary>Register issued invoice</summary>
                                <Editor
                                    class="editor"
                                    onSubmit={(event) =>
                                        submit(
                                            event,
                                            props.perform,
                                            async (fields) =>
                                                (await memberClient()).mutation(
                                                    api.billing.invoices.issue,
                                                    {
                                                        termId: term._id,
                                                        number: text(fields, "number"),
                                                        reference: text(fields, "reference"),
                                                        amount: Number(fields.get("amount")),
                                                        issuedAt: day(fields, "issuedAt"),
                                                        dueAt: day(fields, "dueAt"),
                                                        document: text(fields, "document"),
                                                    },
                                                ),
                                            "Invoice registered. No email sent.",
                                        )
                                    }
                                >
                                    <div class="sponsorship-fields">
                                        <label>
                                            Invoice number
                                            <input name="number" required />
                                        </label>
                                        <label>
                                            RF payment reference
                                            <input name="reference" required />
                                        </label>
                                        <label>
                                            Amount (CHF)
                                            <input
                                                name="amount"
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                required
                                            />
                                        </label>
                                        <label>
                                            Issued
                                            <input name="issuedAt" type="date" required />
                                        </label>
                                        <label>
                                            Due
                                            <input name="dueAt" type="date" required />
                                        </label>
                                        <label>
                                            PDF filename or HTTPS URL
                                            <input name="document" required />
                                        </label>
                                    </div>
                                    <p class="text-soft">
                                        Register an existing invoice. This does not generate or send
                                        a PDF.
                                    </p>
                                    <button class="button" disabled={props.isPending}>
                                        Register invoice
                                    </button>
                                </Editor>
                            </details>
                        </Show>
                    </section>
                )}
            </For>
            <Show when={props.sponsor.status === "requested"}>
                <button
                    class="button"
                    disabled={props.isPending}
                    onClick={() =>
                        props.perform(async () => {
                            await (
                                await memberClient()
                            ).mutation(api.sponsorships.organisations.updateRequest, {
                                id: props.sponsor._id,
                                action: "withdraw",
                            });
                        }, "Request withdrawn.")
                    }
                >
                    Withdraw request
                </button>
                <Show when={props.isAdmin}>
                    <button
                        class="button"
                        disabled={props.isPending}
                        onClick={() =>
                            props.perform(async () => {
                                await (
                                    await memberClient()
                                ).mutation(api.sponsorships.organisations.end, {
                                    id: props.sponsor._id,
                                });
                            }, "Request declined.")
                        }
                    >
                        Decline request
                    </button>
                </Show>
            </Show>
            <Show when={props.sponsor.status === "active" && !props.sponsor.isRenewalRequested}>
                <button
                    class="button"
                    disabled={props.isPending}
                    onClick={() =>
                        props.perform(async () => {
                            await (
                                await memberClient()
                            ).mutation(api.sponsorships.organisations.updateRequest, {
                                id: props.sponsor._id,
                                action: "renew",
                            });
                        }, "Renewal requested.")
                    }
                >
                    Request renewal
                </button>
            </Show>
            <Show when={props.sponsor.isRenewalRequested}>
                <p>Renewal requested.</p>
            </Show>
            <Show when={props.sponsor.history.length === 0}>
                <p class="text-soft">No agreement recorded yet.</p>
            </Show>
        </Card>
    );
}

/** Set explicit dates, contribution and publication with an explanation for each revision. */
function AgreementEditor(props: {
    sponsorshipId: Workspace["sponsorships"][number]["_id"];
    term?: Term;
    perform: Perform;
    isPending: boolean;
}) {
    const [kind, setKind] = createSignal(props.term?.contribution.kind ?? "money");
    return (
        <Editor
            class="editor"
            onSubmit={(event) =>
                submit(
                    event,
                    props.perform,
                    async (fields) =>
                        (await memberClient()).mutation(api.sponsorships.terms.agree, {
                            sponsorshipId: props.sponsorshipId,
                            replacesId: props.term?._id,
                            tier: text(fields, "tier") as "bronze" | "silver" | "gold",
                            contribution:
                                kind() === "money"
                                    ? { kind: "money", amount: Number(fields.get("amount")) }
                                    : { kind: "inKind", description: text(fields, "description") },
                            startsAt: day(fields, "startsAt"),
                            endsAt: timestamp(
                                `${new Date(Date.parse(text(fields, "lastDay")) + 86400000).toISOString().slice(0, 10)}T00:00`,
                            ),
                            publishedAt: text(fields, "publishedAt")
                                ? day(fields, "publishedAt")
                                : undefined,
                            reason: text(fields, "reason"),
                        }),
                    "Agreement saved. No payment recorded.",
                )
            }
        >
            <div class="sponsorship-fields">
                <label>
                    Tier
                    <select name="tier" value={props.term?.tier ?? "bronze"}>
                        <For each={tiers}>
                            {(tier) => <option value={tier.id}>{tier.name}</option>}
                        </For>
                    </select>
                </label>
                <label>
                    Contribution
                    <select
                        value={kind()}
                        onChange={(event) =>
                            setKind(event.currentTarget.value as "money" | "inKind")
                        }
                    >
                        <option value="money">Money</option>
                        <option value="inKind">In kind</option>
                    </select>
                </label>
                <Show
                    when={kind() === "money"}
                    fallback={
                        <label>
                            Contribution description
                            <input
                                name="description"
                                value={
                                    props.term?.contribution.kind === "inKind"
                                        ? props.term.contribution.description
                                        : ""
                                }
                                required
                            />
                        </label>
                    }
                >
                    <label>
                        Agreed amount (CHF)
                        <input
                            type="number"
                            name="amount"
                            min="0.01"
                            step="0.01"
                            value={
                                props.term?.contribution.kind === "money"
                                    ? props.term.contribution.amount
                                    : undefined
                            }
                            required
                        />
                    </label>
                </Show>
                <label>
                    Benefits start
                    <input
                        name="startsAt"
                        type="date"
                        value={props.term ? date(props.term.startsAt) : ""}
                        required
                    />
                </label>
                <label>
                    Last day of benefits
                    <input
                        name="lastDay"
                        type="date"
                        value={props.term ? date(props.term.endsAt - 1) : ""}
                        required
                    />
                </label>
                <label>
                    Public recognition from
                    <input
                        name="publishedAt"
                        type="date"
                        value={
                            props.term?.publishedAt !== undefined
                                ? date(props.term.publishedAt)
                                : ""
                        }
                    />
                </label>
            </div>
            <label>
                Reason / agreement note
                <input name="reason" required />
            </label>
            <p class="text-soft">
                Leave publication blank to keep recognition private. Payments do not change these
                dates.
            </p>
            <button class="button" disabled={props.isPending}>
                {props.term ? "Save amendment" : "Agree sponsorship"}
            </button>
        </Editor>
    );
}

/** Show settlement and retain receipts, refunds and voided invoices. */
function InvoiceCard(props: {
    invoice: Invoice;
    isAdmin: boolean;
    isPending: boolean;
    perform: Perform;
}) {
    const invoice = () => props.invoice;
    return (
        <section class="sponsorship-invoice">
            <h4>
                {invoice().number} ·{" "}
                {invoice().voidedAt
                    ? "Void"
                    : invoice().balance < 0
                      ? "Overpaid"
                      : invoice().balance === 0
                        ? "Paid"
                        : invoice().received > 0
                          ? "Part paid"
                          : "Unpaid"}
            </h4>
            <p>
                {money(invoice().amount)} · Due {date(invoice().dueAt)} · Balance{" "}
                {money(invoice().balance)}
            </p>
            <p class="text-soft">
                {invoice().reference} · {invoice().document}
            </p>
            <Show when={invoice().voidReason}>
                <p>{invoice().voidReason}</p>
            </Show>
            <For each={invoice().payments}>
                {(payment) => (
                    <div>
                        <p>
                            Received {money(payment.amount)} on {date(payment.paidAt)} ·{" "}
                            {payment.reference}
                        </p>
                        <For each={payment.refunds}>
                            {(refund) => (
                                <p>
                                    Refunded {money(refund.amount)} on {date(refund.paidAt)} ·{" "}
                                    {refund.reference} · {refund.reason}
                                </p>
                            )}
                        </For>
                        <Show when={props.isAdmin}>
                            <details>
                                <summary>Record refund</summary>
                                <Editor
                                    class="editor"
                                    onSubmit={(event) =>
                                        submit(
                                            event,
                                            props.perform,
                                            async (fields) =>
                                                (await memberClient()).mutation(
                                                    api.billing.invoices.refund,
                                                    {
                                                        paymentId: payment._id,
                                                        amount: Number(fields.get("amount")),
                                                        paidAt: day(fields, "paidAt"),
                                                        reference: text(fields, "reference"),
                                                        reason: text(fields, "reason"),
                                                    },
                                                ),
                                            "Refund recorded.",
                                        )
                                    }
                                >
                                    <ReceiptFields />
                                    <label>
                                        Reason
                                        <input name="reason" required />
                                    </label>
                                    <button class="button" disabled={props.isPending}>
                                        Record refund
                                    </button>
                                </Editor>
                            </details>
                        </Show>
                    </div>
                )}
            </For>
            <Show when={props.isAdmin && !invoice().voidedAt}>
                <details>
                    <summary>Record payment</summary>
                    <Editor
                        class="editor"
                        onSubmit={(event) =>
                            submit(
                                event,
                                props.perform,
                                async (fields) =>
                                    (await memberClient()).mutation(api.billing.invoices.receive, {
                                        invoiceId: invoice()._id,
                                        amount: Number(fields.get("amount")),
                                        paidAt: day(fields, "paidAt"),
                                        reference: text(fields, "reference"),
                                    }),
                                "Payment recorded.",
                            )
                        }
                    >
                        <ReceiptFields />
                        <p class="text-soft">
                            Record money actually received. Use the bank transaction reference, not
                            the invoice’s RF reference.
                        </p>
                        <button class="button" disabled={props.isPending}>
                            Record payment
                        </button>
                    </Editor>
                </details>
                <details>
                    <summary>Void invoice</summary>
                    <Editor
                        class="editor"
                        onSubmit={(event) =>
                            submit(
                                event,
                                props.perform,
                                async (fields) =>
                                    (await memberClient()).mutation(
                                        api.billing.invoices.voidInvoice,
                                        { id: invoice()._id, reason: text(fields, "reason") },
                                    ),
                                "Invoice voided.",
                            )
                        }
                    >
                        <label>
                            Reason
                            <input name="reason" required />
                        </label>
                        <button class="button" disabled={props.isPending}>
                            Void invoice
                        </button>
                    </Editor>
                </details>
            </Show>
        </section>
    );
}

/** Capture actual bank transaction details for a receipt or refund. */
function ReceiptFields() {
    return (
        <div class="sponsorship-fields">
            <label>
                Amount (CHF)
                <input name="amount" type="number" min="0.01" step="0.01" required />
            </label>
            <label>
                Transaction date
                <input name="paidAt" type="date" max={date(Date.now())} required />
            </label>
            <label>
                Bank transaction reference
                <input name="reference" required />
            </label>
        </div>
    );
}
