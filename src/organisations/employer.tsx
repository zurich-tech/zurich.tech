import { Show } from "solid-js";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { tiers, jobPrice, jobDurationMonths } from "../sponsorships/plans";
import { timeZone } from "../app/site";
import { memberClient } from "../auth/convex";
import type { Perform } from "../app/workspace";
import { Card } from "../components/card";
import { CheckoutButton } from "../billing/payments";
import { Markdown } from "../components/markdown";

/** Owned companies, vacancies and sponsorship agreements. */
type EmployerWorkspace = FunctionReturnType<typeof api.organisations.workspace.employer>;

/** Manage a vacancy and review its pending changes. */
export function JobCard(props: {
    /** Vacancy and its unpublished revision. */
    job: EmployerWorkspace["jobs"][number];
    /** Company identities displayed in the card. */
    companies: EmployerWorkspace["organisations"];
    /** Allow team review controls. */
    isTeam: boolean;
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
    /** Run a command and refresh its visible result. */
    perform: Perform;
}) {
    return (
        <Card
            title={props.job.title}
            meta={
                props.job.draft
                    ? `${props.job.status} · ${props.job.draftStatus} revision`
                    : props.job.status
            }
        >
            <p>
                {props.companies.find((company) => company._id === props.job.organisationId)?.name}
            </p>
            <Show when={props.job.reviewNote}>
                <p>{props.job.reviewNote}</p>
            </Show>
            <Show when={props.job.expiresAt}>
                <p class="text-soft">
                    Term ends {date(props.job.expiresAt!)} · Last confirmed{" "}
                    {props.job.confirmedAt ? date(props.job.confirmedAt) : "Not published"}
                </p>
            </Show>
            <Show
                when={
                    props.job.status === "published" &&
                    props.job.confirmedAt! + 90 * 86400000 <= Date.now()
                }
            >
                <p class="form-error">Hidden until you confirm this role is still open.</p>
            </Show>
            <div class="row-actions">
                <Show when={props.job.status !== "draft"}>
                    <CheckoutButton
                        purchase={{ kind: "job", id: props.job._id }}
                        label={
                            props.job.expiresAt && props.job.expiresAt > Date.now()
                                ? "Renew listing"
                                : "Pay for listing"
                        }
                    />
                </Show>
                <a href={`/jobs/submit?edit=${props.job._id}`}>Edit</a>
                <Show when={props.job.publishedAt}>
                    <a href={`/jobs/${props.job.slug}`}>View</a>
                </Show>
                <Show when={props.job.status === "published"}>
                    <button
                        disabled={props.isPending}
                        onClick={() =>
                            props.perform(
                                async () =>
                                    (await memberClient()).mutation(api.jobs.jobs.updateStatus, {
                                        id: props.job._id,
                                        action: "confirm",
                                    }),
                                "Vacancy confirmed.",
                            )
                        }
                    >
                        Still hiring
                    </button>
                </Show>
                <Show when={props.job.status !== "closed"}>
                    <button
                        disabled={props.isPending}
                        onClick={() =>
                            props.perform(
                                async () =>
                                    (await memberClient()).mutation(api.jobs.jobs.updateStatus, {
                                        id: props.job._id,
                                        action: "close",
                                    }),
                                "Listing closed.",
                            )
                        }
                    >
                        Close listing
                    </button>
                </Show>
            </div>
            <Show when={props.isTeam}>
                <JobReview job={props.job} isPending={props.isPending} perform={props.perform} />
            </Show>
        </Card>
    );
}

/** Manage one sponsorship request, renewal and payment. */
export function SponsorshipCard(props: {
    /** Sponsorship request and its paid or in-kind term. */
    sponsor: EmployerWorkspace["sponsorships"][number];
    /** Company identities displayed in the card. */
    companies: EmployerWorkspace["organisations"];
    /** Allow team review controls. */
    isTeam: boolean;
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
    /** Run a command and refresh its visible result. */
    perform: Perform;
}) {
    /** Activate the paid sponsorship term. */
    function activate(event: SubmitEvent) {
        // read the submitted review fields
        event.preventDefault();
        const invoiceReference = String(
            new FormData(event.currentTarget as HTMLFormElement).get("invoiceReference"),
        );

        // apply the decision and refresh the workspace
        void props.perform(
            async () =>
                (await memberClient()).mutation(api.sponsorships.organisations.activate, {
                    id: props.sponsor._id,
                    invoiceReference,
                }),
            "Annual sponsorship activated.",
        );
    }

    /** End or decline the sponsorship request. */
    function end(event: SubmitEvent) {
        event.preventDefault();
        if (
            !window.confirm(
                props.sponsor.status === "requested"
                    ? "Decline this sponsorship request?"
                    : "End this sponsorship?",
            )
        )
            return;
        void props.perform(
            async () =>
                (await memberClient()).mutation(api.sponsorships.organisations.end, {
                    id: props.sponsor._id,
                }),
            "Sponsorship updated.",
        );
    }

    return (
        <article class="sponsorship-record">
            <header class="sponsorship-heading">
                <h3>
                    {props.companies.find((company) => company._id === props.sponsor.organisationId)
                        ?.name ?? "Organisation"}
                </h3>
                <span class="sponsorship-status">
                    {
                        {
                            active: "Active",
                            requested: "Requested",
                            declined: "Declined",
                            ended: "Ended",
                        }[props.sponsor.status]
                    }
                </span>
            </header>
            <dl class="sponsorship-details">
                <div>
                    <dt>Tier</dt>
                    <dd>{tiers.find((tier) => tier.id === props.sponsor.tier)?.name}</dd>
                </div>
                <div>
                    <dt>Contribution</dt>
                    <dd>
                        <Show when={!props.sponsor.inKind} fallback="In kind">
                            CHF {tiers.find((tier) => tier.id === props.sponsor.tier)?.price}/year
                        </Show>
                    </dd>
                </div>
                <Show when={props.sponsor.endsAt}>
                    <div>
                        <dt>Term</dt>
                        <dd>
                            {date(props.sponsor.startsAt!)} – {date(props.sponsor.endsAt!)}
                        </dd>
                    </div>
                </Show>
            </dl>
            <Show when={props.sponsor.note}>
                <p>{props.sponsor.note}</p>
            </Show>
            <Show when={props.sponsor.inKind}>
                {(agreement) => <p>{agreement().description}</p>}
            </Show>
            <Show when={props.sponsor.billingEmail}>
                <p class="text-soft">{props.sponsor.billingEmail}</p>
            </Show>
            <Show when={props.sponsor.status === "requested"}>
                <p>Awaiting payment.</p>
            </Show>
            <Show when={props.sponsor.status === "active" && !props.sponsor.inKind}>
                <p>
                    {props.sponsor.endsAt! <= Date.now()
                        ? "This term has expired. Request renewal below."
                        : "No automatic renewal. The team can extend your term after confirming the next invoice."}
                </p>
            </Show>
            <Show when={props.sponsor.isRenewalRequested}>
                <p>Renewal requested. Awaiting invoice payment.</p>
            </Show>
            <Show
                when={
                    props.sponsor.status === "active" &&
                    !props.sponsor.inKind &&
                    !props.sponsor.isRenewalRequested
                }
            >
                <button
                    class="button"
                    disabled={props.isPending}
                    onClick={() =>
                        props.perform(
                            async () =>
                                (await memberClient()).mutation(
                                    api.sponsorships.organisations.updateRequest,
                                    {
                                        id: props.sponsor._id,
                                        action: "renew",
                                    },
                                ),
                            "Renewal requested.",
                        )
                    }
                >
                    Request renewal
                </button>
            </Show>
            <Show when={props.sponsor.status === "requested"}>
                <button
                    class="button"
                    disabled={props.isPending}
                    onClick={() =>
                        props.perform(
                            async () =>
                                (await memberClient()).mutation(
                                    api.sponsorships.organisations.updateRequest,
                                    {
                                        id: props.sponsor._id,
                                        action: "withdraw",
                                    },
                                ),
                            "Request withdrawn.",
                        )
                    }
                >
                    Withdraw request
                </button>
            </Show>
            <Show
                when={
                    !props.sponsor.inKind &&
                    (props.sponsor.status === "requested" || props.sponsor.status === "active")
                }
            >
                <CheckoutButton
                    purchase={{
                        kind: "sponsorship",
                        id: props.sponsor._id,
                    }}
                    label={
                        props.sponsor.status === "active" ? "Renew sponsorship" : "Pay sponsorship"
                    }
                />
            </Show>
            <Show when={props.isTeam}>
                <Show when={!props.sponsor.inKind}>
                    <form class="editor" onSubmit={activate}>
                        <label>
                            Paid invoice reference
                            <input name="invoiceReference" required />
                        </label>
                        <button class="button button--primary" disabled={props.isPending}>
                            {props.sponsor.status === "active"
                                ? "Confirm renewal payment"
                                : "Confirm payment & activate"}
                        </button>
                    </form>
                </Show>
                <Show
                    when={props.sponsor.status === "active" || props.sponsor.status === "requested"}
                >
                    <form class="sponsorship-actions" onSubmit={end}>
                        <button class="button" disabled={props.isPending}>
                            {props.sponsor.status === "requested"
                                ? "Decline request"
                                : "End sponsorship"}
                        </button>
                    </form>
                </Show>
            </Show>
        </article>
    );
}

/** Review a vacancy and allocate its publication funding. */
function JobReview(props: {
    /** Vacancy and pending editorial revision. */
    job: EmployerWorkspace["jobs"][number];
    /** Disable controls during a workspace command. */
    isPending: boolean;
    /** Apply the review and refresh the vacancy. */
    perform: Perform;
}) {
    /** Publish the reviewed vacancy with its funding. */
    function publish(event: SubmitEvent) {
        // read the submitted review fields
        event.preventDefault();
        const fields = new FormData(event.currentTarget as HTMLFormElement);

        // apply the decision and refresh the workspace
        void props.perform(
            async () =>
                (await memberClient()).mutation(api.jobs.jobs.publish, {
                    id: props.job._id,
                    funding: String(fields.get("funding")) as "existing" | "invoice" | "sponsor",
                    invoiceReference: String(fields.get("invoiceReference") ?? "") || undefined,
                }),
            "Job published.",
        );
    }

    /** Return the vacancy to its author with a review note. */
    function decline(event: SubmitEvent) {
        // read the submitted review fields
        event.preventDefault();
        const note = String(new FormData(event.currentTarget as HTMLFormElement).get("note"));

        // apply the decision and refresh the workspace
        void props.perform(
            async () =>
                (await memberClient()).mutation(api.jobs.jobs.updateStatus, {
                    id: props.job._id,
                    action: "decline",
                    note,
                }),
            "Review returned to the employer.",
        );
    }

    return (
        <details class="review-details">
            <summary>Review & publication</summary>
            <h3>{(props.job.draft ?? props.job).title}</h3>
            <p>{(props.job.draft ?? props.job).billingEmail}</p>
            <Markdown source={(props.job.draft ?? props.job).description} />
            <p>
                <a
                    class="text-link"
                    href={(props.job.draft ?? props.job).applicationUrl}
                    target="_blank"
                    rel="noreferrer"
                >
                    Application destination
                </a>
            </p>
            <details>
                <summary>Record a manual payment</summary>
                <form class="editor" onSubmit={publish}>
                    <label>
                        Funding
                        <select name="funding">
                            <option value="invoice">
                                Paid invoice · CHF {jobPrice} / {jobDurationMonths} months
                            </option>
                            <option value="sponsor">Included sponsorship slot</option>
                            <Show when={props.job.expiresAt! > Date.now()}>
                                <option value="existing">Keep existing paid term</option>
                            </Show>
                        </select>
                    </label>
                    <label>
                        Paid invoice reference
                        <input name="invoiceReference" placeholder="Required for a paid listing" />
                    </label>
                    <button class="button button--primary" disabled={props.isPending}>
                        Approve & publish
                    </button>
                </form>
            </details>
            <form class="editor" onSubmit={decline}>
                <label>
                    Review note
                    <textarea name="note" required rows="2" />
                </label>
                <button class="button" disabled={props.isPending}>
                    Return for changes
                </button>
            </form>
        </details>
    );
}

/** Format workspace dates in the local timezone. */
function date(value: number): string {
    return new Date(value).toLocaleDateString("en-GB", { timeZone });
}
