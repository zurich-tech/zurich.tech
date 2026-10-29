import { civilTime, timestamp } from "../../convex/events/time";
import "./editor.css";
import { For, Show, createSignal, type JSX } from "solid-js";
import { Pencil, Plus, ExternalLink } from "lucide-solid";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { memberClient } from "../auth/convex";
import type { Perform } from "../app/workspace";
import { Editor, savedEditor } from "../components/form";
import { Card } from "../components/card";
import { tiers } from "../../convex/sponsorships/plans";
import { FilterSelect } from "../components/filter-select";
import { Dialog } from "../components/dialog";
import { Image } from "../components/image";
import { errorMessage } from "../components/errors";

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
        <Card
            title={
                <span class="sponsorship-title">
                    <Show when={company()?.logoUrl}>
                        <Image src={company()!.logoUrl!} darkSrc={company()?.logoDarkUrl} alt="" />
                    </Show>
                    <span>
                        {company()?.name ?? "Sponsorship"}
                        <span class="sponsorship-recognition">
                            <span class="sponsorship-tier">
                                {props.sponsor.recognition ?? props.sponsor.tier}
                            </span>
                            <span class="text-soft">
                                {props.sponsor.recognition
                                    ? "Public sponsor"
                                    : "Private sponsorship"}
                            </span>
                        </span>
                    </span>
                </span>
            }
            class="sponsorship-editor"
            toolbar={
                <Show when={company()}>
                    {(organisation) => (
                        <a class="action-link" href={`/organisations/${organisation().slug}`}>
                            Organisation <ExternalLink size={14} />
                        </a>
                    )}
                </Show>
            }
        >
            <Show when={props.sponsor.billingEmail}>
                <div class="sponsorship-contact">
                    <span class="text-soft">Billing contact</span>
                    <a href={`mailto:${props.sponsor.billingEmail}`}>
                        {props.sponsor.billingEmail}
                    </a>
                </div>
            </Show>
            <div class="sponsorship-section-heading">
                <h3>{props.sponsor.history.length > 1 ? "Agreements" : "Agreement"}</h3>
                <Show when={props.isAdmin}>
                    <SponsorAction
                        title={
                            props.sponsor.history.length ? "Renew sponsorship" : "Record agreement"
                        }
                        perform={props.perform}
                        icon={<Plus size={14} />}
                    >
                        {(perform) => (
                            <AgreementEditor
                                sponsorshipId={props.sponsor._id}
                                defaultTier={props.sponsor.tier}
                                perform={perform}
                                isPending={props.isPending}
                            />
                        )}
                    </SponsorAction>
                </Show>
            </div>
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
                        <dl class="sponsorship-facts">
                            <div>
                                <dt>Period</dt>
                                <dd>
                                    {date(term.startsAt)} – {date(term.endsAt - 1)}
                                </dd>
                            </div>
                            <div>
                                <dt>
                                    {term.contribution.kind === "money"
                                        ? "Agreed contribution"
                                        : "In-kind contribution"}
                                </dt>
                                <dd class="sponsorship-contribution">
                                    {term.contribution.kind === "money"
                                        ? money(term.contribution.amount)
                                        : term.contribution.description}
                                </dd>
                            </div>
                            <div>
                                <dt>Recognition</dt>
                                <dd>
                                    {term.publishedAt !== undefined
                                        ? `From ${date(term.publishedAt)}`
                                        : "Private"}
                                </dd>
                            </div>
                        </dl>
                        <details class="sponsorship-audit">
                            <summary>Recorded agreement</summary>
                            <p class="text-soft">
                                {term.reason} · {term.recordedByName} · {date(term.createdAt)}
                            </p>
                        </details>
                        <Show when={term.endedAt !== undefined}>
                            <p>
                                Ended {date(term.endedAt!)}: {term.endReason}
                            </p>
                        </Show>
                        <Show
                            when={props.isAdmin && !term.supersededAt && term.endedAt === undefined}
                        >
                            <div class="sponsorship-actions">
                                <SponsorAction
                                    title="Edit agreement"
                                    perform={props.perform}
                                    icon={<Pencil size={14} />}
                                >
                                    {(perform) => (
                                        <AgreementEditor
                                            sponsorshipId={props.sponsor._id}
                                            term={term}
                                            perform={perform}
                                            isPending={props.isPending}
                                        />
                                    )}
                                </SponsorAction>
                                <SponsorAction title="End agreement" perform={props.perform}>
                                    {(perform) => (
                                        <Editor
                                            class="editor"
                                            onSubmit={(event) =>
                                                submit(
                                                    event,
                                                    perform,
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
                                    )}
                                </SponsorAction>
                            </div>
                        </Show>
                        <Show when={term.contribution.kind === "money" || term.invoices.length > 0}>
                            <div class="sponsorship-billing">
                                <div class="sponsorship-section-heading">
                                    <h3>Invoices &amp; payments</h3>
                                </div>
                                <Show when={!term.invoices.length}>
                                    <p class="text-soft">
                                        {term.contribution.kind === "inKind"
                                            ? "In-kind contribution. No invoice required."
                                            : "No invoices recorded."}
                                    </p>
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
                                    <SponsorAction
                                        title="Register issued invoice"
                                        perform={props.perform}
                                        icon={<Plus size={14} />}
                                    >
                                        {(perform) => (
                                            <Editor
                                                class="editor"
                                                onSubmit={(event) =>
                                                    submit(
                                                        event,
                                                        perform,
                                                        async (fields) =>
                                                            (await memberClient()).mutation(
                                                                api.billing.invoices.issue,
                                                                {
                                                                    termId: term._id,
                                                                    number: text(fields, "number"),
                                                                    reference: text(
                                                                        fields,
                                                                        "reference",
                                                                    ),
                                                                    amount: Number(
                                                                        fields.get("amount"),
                                                                    ),
                                                                    issuedAt: day(
                                                                        fields,
                                                                        "issuedAt",
                                                                    ),
                                                                    dueAt: day(fields, "dueAt"),
                                                                    document: text(
                                                                        fields,
                                                                        "document",
                                                                    ),
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
                                                        <input
                                                            name="issuedAt"
                                                            type="date"
                                                            required
                                                        />
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
                                                    Register an existing invoice. This does not
                                                    generate or send a PDF.
                                                </p>
                                                <button class="button" disabled={props.isPending}>
                                                    Register invoice
                                                </button>
                                            </Editor>
                                        )}
                                    </SponsorAction>
                                </Show>
                            </div>
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
            <Show
                when={
                    !props.isAdmin &&
                    props.sponsor.status === "active" &&
                    !props.sponsor.isRenewalRequested
                }
            >
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

/** Open one edit without expanding the sponsor overview into a form. */
function SponsorAction(props: {
    title: string;
    icon?: JSX.Element;
    perform: Perform;
    children: (perform: Perform) => JSX.Element;
}) {
    const [isOpen, setOpen] = createSignal(false);
    const [error, setError] = createSignal<string>();
    const perform: Perform = async (operation, message) => {
        setError(undefined);
        await props.perform(async () => {
            try {
                const result = await operation();
                if (result !== false) setOpen(false);
                return result;
            } catch (caught) {
                setError(errorMessage(caught, "Could not save. Try again."));
                throw caught;
            }
        }, message);
    };

    return (
        <>
            <button type="button" class="action-link" onClick={() => setOpen(true)}>
                {props.icon}
                {props.title}
            </button>
            <Show when={isOpen()}>
                <Dialog
                    isOpen
                    title={props.title}
                    onClose={() => setOpen(false)}
                    actions={
                        <button type="button" class="button" onClick={() => setOpen(false)}>
                            Cancel
                        </button>
                    }
                >
                    <Show when={error()}>
                        <p role="alert">{error()}</p>
                    </Show>
                    {props.children(perform)}
                </Dialog>
            </Show>
        </>
    );
}

/** Set explicit dates, contribution and publication with an explanation for each revision. */
function AgreementEditor(props: {
    sponsorshipId: Workspace["sponsorships"][number]["_id"];
    term?: Term;
    defaultTier?: "gold" | "silver" | "bronze";
    perform: Perform;
    isPending: boolean;
}) {
    const [kind, setKind] = createSignal(props.term?.contribution.kind ?? "money");
    const [tier, setTier] = createSignal(props.term?.tier ?? props.defaultTier ?? "bronze");
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
                <div class="sponsorship-field">
                    <span>Tier</span>
                    <input type="hidden" name="tier" value={tier()} />
                    <FilterSelect
                        label="Tier"
                        value={tier()}
                        onChange={(value) => setTier(value as "gold" | "silver" | "bronze")}
                        options={tiers.map((tier) => ({ value: tier.id, label: tier.name }))}
                    />
                </div>
                <div class="sponsorship-field">
                    <span>Contribution</span>
                    <FilterSelect
                        label="Contribution"
                        value={kind()}
                        onChange={(value) => setKind(value as "money" | "inKind")}
                        options={[
                            { value: "money", label: "Money" },
                            { value: "inKind", label: "In kind" },
                        ]}
                    />
                </div>
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
            <div class="sponsorship-invoice-heading">
                <h4>{invoice().number}</h4>
                <span
                    class="sponsorship-payment-status"
                    classList={{ "is-paid": !invoice().voidedAt && invoice().balance === 0 }}
                >
                    {invoice().voidedAt
                        ? "Void"
                        : invoice().balance < 0
                          ? "Overpaid"
                          : invoice().balance === 0
                            ? "Paid"
                            : invoice().received > 0
                              ? "Part paid"
                              : "Unpaid"}
                </span>
            </div>
            <dl class="sponsorship-facts sponsorship-invoice-facts">
                <div>
                    <dt>Amount</dt>
                    <dd>{money(invoice().amount)}</dd>
                </div>
                <div>
                    <dt>Issued</dt>
                    <dd>{date(invoice().issuedAt)}</dd>
                </div>
                <div>
                    <dt>Due</dt>
                    <dd>{date(invoice().dueAt)}</dd>
                </div>
                <div>
                    <dt>Outstanding</dt>
                    <dd>{money(invoice().balance)}</dd>
                </div>
            </dl>
            <details class="sponsorship-audit">
                <summary>Invoice details</summary>
                <dl class="sponsorship-facts">
                    <div>
                        <dt>Payment reference</dt>
                        <dd>{invoice().reference}</dd>
                    </div>
                    <div>
                        <dt>Document</dt>
                        <dd>{invoice().document}</dd>
                    </div>
                </dl>
            </details>
            <Show when={invoice().voidReason}>
                <p>{invoice().voidReason}</p>
            </Show>
            <For each={invoice().payments}>
                {(payment) => (
                    <div class="sponsorship-receipt">
                        <p>
                            {payment.confirmation ? "Confirmed" : "Received"}{" "}
                            {money(payment.amount)}
                            {payment.paidAt !== undefined
                                ? ` on ${date(payment.paidAt)}`
                                : " · Date unavailable"}
                        </p>
                        <p class="text-soft">{payment.confirmation ?? payment.reference}</p>
                        <For each={payment.refunds}>
                            {(refund) => (
                                <p>
                                    Refunded {money(refund.amount)} on {date(refund.paidAt)} ·{" "}
                                    {refund.reference} · {refund.reason}
                                </p>
                            )}
                        </For>
                        <Show when={props.isAdmin}>
                            <SponsorAction title="Record refund" perform={props.perform}>
                                {(perform) => (
                                    <Editor
                                        class="editor"
                                        onSubmit={(event) =>
                                            submit(
                                                event,
                                                perform,
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
                                )}
                            </SponsorAction>
                        </Show>
                    </div>
                )}
            </For>
            <Show when={props.isAdmin && !invoice().voidedAt}>
                <div class="sponsorship-actions">
                    <Show when={invoice().balance > 0}>
                        <SponsorAction title="Confirm paid" perform={props.perform}>
                            {(perform) => (
                                <Editor
                                    class="editor"
                                    onSubmit={(event) =>
                                        submit(
                                            event,
                                            perform,
                                            async (fields) =>
                                                (await memberClient()).mutation(
                                                    api.billing.invoices.confirmPayment,
                                                    {
                                                        invoiceId: invoice()._id,
                                                        note: text(fields, "note"),
                                                    },
                                                ),
                                            "Payment confirmed.",
                                        )
                                    }
                                >
                                    <p>
                                        Confirm the remaining {money(invoice().balance)} was
                                        received.
                                    </p>
                                    <label>
                                        Confirmation note
                                        <textarea name="note" required maxLength={1000} />
                                    </label>
                                    <button class="button" disabled={props.isPending}>
                                        Confirm paid
                                    </button>
                                </Editor>
                            )}
                        </SponsorAction>
                    </Show>
                    <SponsorAction title="Record payment" perform={props.perform}>
                        {(perform) => (
                            <Editor
                                class="editor"
                                onSubmit={(event) =>
                                    submit(
                                        event,
                                        perform,
                                        async (fields) =>
                                            (await memberClient()).mutation(
                                                api.billing.invoices.receive,
                                                {
                                                    invoiceId: invoice()._id,
                                                    amount: Number(fields.get("amount")),
                                                    paidAt: day(fields, "paidAt"),
                                                    reference: text(fields, "reference"),
                                                },
                                            ),
                                        "Payment recorded.",
                                    )
                                }
                            >
                                <ReceiptFields />
                                <p class="text-soft">
                                    Record money actually received. Use the bank transaction
                                    reference, not the invoice’s RF reference.
                                </p>
                                <button class="button" disabled={props.isPending}>
                                    Record payment
                                </button>
                            </Editor>
                        )}
                    </SponsorAction>
                    <SponsorAction title="Void invoice" perform={props.perform}>
                        {(perform) => (
                            <Editor
                                class="editor"
                                onSubmit={(event) =>
                                    submit(
                                        event,
                                        perform,
                                        async (fields) =>
                                            (await memberClient()).mutation(
                                                api.billing.invoices.voidInvoice,
                                                {
                                                    id: invoice()._id,
                                                    reason: text(fields, "reason"),
                                                },
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
                        )}
                    </SponsorAction>
                </div>
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
