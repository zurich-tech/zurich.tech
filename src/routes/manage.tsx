import { timeZone } from "../core/constants";

import { CheckoutButton } from "../component/payments";
import { Show, For, createSignal } from "solid-js";
import { api } from "../../convex/_generated/api";
import { tiers, jobPrice } from "../../shared/plans";
import { useEmployerWorkspace } from "../core/workspace";
import { CompanyForm } from "../component/company";
import { memberClient } from "../core/convex";
import { Page, PageHeader } from "../component/page";
import { Card } from "../component/card";
import { Seo } from "../component/seo";
import { Markdown } from "../component/markdown";
import { FormMessage } from "../component/form";
import { errorMessage } from "../core/error";

/** Manage company profiles, reviewed jobs, invoices and sponsorship terms. */
export default function Route() {
    const { account, workspace, refetch } = useEmployerWorkspace();
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Apply one authorised command and refresh the complete workspace. */
    async function perform(action: () => Promise<unknown>, message: string) {
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await action();
            await refetch();
            setSuccess(message);
        } catch (caught) {
            setError(errorMessage(caught, "Could not save the change."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo
                title="Jobs & sponsors"
                description="Manage your company, vacancies and community support."
            />
            <Page>
                <PageHeader title="Jobs & sponsors" />
                <nav class="filter-bar">
                    <a class="button" href="/admin">
                        Events workspace
                    </a>
                    <a class="button" href="#jobs">
                        Jobs
                    </a>
                    <a class="button" href="#sponsors">
                        Sponsorships
                    </a>
                    <a class="button" href="#companies">
                        Companies
                    </a>
                </nav>
                <Show
                    when={account.user()}
                    fallback={
                        <Card title="Your workspace">
                            <a class="button" href="/sign-in?next=%2Fmanage">
                                Sign in with GitHub or X
                            </a>
                        </Card>
                    }
                >
                    <Show when={workspace.error}>
                        <p class="form-error">
                            {errorMessage(workspace.error, "Could not load workspace.")}
                        </p>
                    </Show>
                    <FormMessage error={error()} success={success()} />
                    <Show when={workspace()}>
                        {(current) => (
                            <div class="management-sections">
                                {/* manage vacancy revisions and publication */}
                                <section id="jobs">
                                    <div class="management-heading">
                                        <h2>Jobs</h2>
                                        <a class="button button--primary" href="/jobs/submit">
                                            Post a job
                                        </a>
                                    </div>
                                    <Show when={!current().jobs.length}>
                                        <Card title="Your listings">
                                            <p>No jobs yet.</p>
                                        </Card>
                                    </Show>
                                    <For each={current().jobs}>
                                        {(job) => (
                                            <Card
                                                title={job.title}
                                                meta={
                                                    job.draft
                                                        ? `${job.status} · ${job.draftStatus} revision`
                                                        : job.status
                                                }
                                            >
                                                <p>
                                                    {
                                                        current().organisations.find(
                                                            (company) =>
                                                                company._id === job.organisationId,
                                                        )?.name
                                                    }
                                                </p>
                                                <Show when={job.reviewNote}>
                                                    <p>{job.reviewNote}</p>
                                                </Show>
                                                <Show when={job.expiresAt}>
                                                    <p class="text-soft">
                                                        Term ends {date(job.expiresAt!)} · Last
                                                        confirmed{" "}
                                                        {job.confirmedAt
                                                            ? date(job.confirmedAt)
                                                            : "Not published"}
                                                    </p>
                                                </Show>
                                                <Show
                                                    when={
                                                        job.status === "published" &&
                                                        job.confirmedAt! + 90 * 86400000 <=
                                                            Date.now()
                                                    }
                                                >
                                                    <p class="form-error">
                                                        Hidden until you confirm this role is still
                                                        open.
                                                    </p>
                                                </Show>
                                                <div class="row-actions">
                                                    <Show when={job.status !== "draft"}>
                                                        <CheckoutButton
                                                            purchase={{ kind: "job", id: job._id }}
                                                            label={
                                                                job.expiresAt &&
                                                                job.expiresAt > Date.now()
                                                                    ? "Renew listing"
                                                                    : "Pay for listing"
                                                            }
                                                        />
                                                    </Show>
                                                    <a href={`/jobs/submit?edit=${job._id}`}>
                                                        Edit
                                                    </a>
                                                    <Show when={job.publishedAt}>
                                                        <a href={`/jobs/${job.slug}`}>View</a>
                                                    </Show>
                                                    <Show when={job.status === "published"}>
                                                        <button
                                                            disabled={isPending()}
                                                            onClick={() =>
                                                                perform(
                                                                    async () =>
                                                                        (
                                                                            await memberClient()
                                                                        ).mutation(
                                                                            api.jobs.updateStatus,
                                                                            {
                                                                                id: job._id,
                                                                                action: "confirm",
                                                                            },
                                                                        ),
                                                                    "Vacancy confirmed.",
                                                                )
                                                            }
                                                        >
                                                            Still hiring
                                                        </button>
                                                    </Show>
                                                    <Show when={job.status !== "closed"}>
                                                        <button
                                                            disabled={isPending()}
                                                            onClick={() =>
                                                                perform(
                                                                    async () =>
                                                                        (
                                                                            await memberClient()
                                                                        ).mutation(
                                                                            api.jobs.updateStatus,
                                                                            {
                                                                                id: job._id,
                                                                                action: "close",
                                                                            },
                                                                        ),
                                                                    "Listing closed.",
                                                                )
                                                            }
                                                        >
                                                            Close listing
                                                        </button>
                                                    </Show>
                                                </div>
                                                <Show when={current().isTeam}>
                                                    <details class="review-details">
                                                        <summary>Review & publication</summary>
                                                        <h3>{(job.draft ?? job).title}</h3>
                                                        <p>{(job.draft ?? job).billingEmail}</p>
                                                        <Markdown
                                                            source={(job.draft ?? job).description}
                                                        />
                                                        <p>
                                                            <a
                                                                class="text-link"
                                                                href={
                                                                    (job.draft ?? job)
                                                                        .applicationUrl
                                                                }
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                Application destination
                                                            </a>
                                                        </p>
                                                        <details>
                                                            <summary>
                                                                Record a manual payment
                                                            </summary>
                                                            <form
                                                                class="editor"
                                                                onSubmit={(event) => {
                                                                    event.preventDefault();
                                                                    const fields = new FormData(
                                                                        event.currentTarget,
                                                                    );
                                                                    void perform(
                                                                        async () =>
                                                                            (
                                                                                await memberClient()
                                                                            ).mutation(
                                                                                api.jobs.publish,
                                                                                {
                                                                                    id: job._id,
                                                                                    funding: String(
                                                                                        fields.get(
                                                                                            "funding",
                                                                                        ),
                                                                                    ) as
                                                                                        | "existing"
                                                                                        | "invoice"
                                                                                        | "sponsor",
                                                                                    invoiceReference:
                                                                                        String(
                                                                                            fields.get(
                                                                                                "invoiceReference",
                                                                                            ) ?? "",
                                                                                        ) ||
                                                                                        undefined,
                                                                                },
                                                                            ),
                                                                        "Job published.",
                                                                    );
                                                                }}
                                                            >
                                                                <label>
                                                                    Funding
                                                                    <select name="funding">
                                                                        <option value="invoice">
                                                                            Paid invoice · CHF{" "}
                                                                            {jobPrice} / year
                                                                        </option>
                                                                        <option value="sponsor">
                                                                            Included sponsorship
                                                                            slot
                                                                        </option>
                                                                        <Show
                                                                            when={
                                                                                job.expiresAt! >
                                                                                Date.now()
                                                                            }
                                                                        >
                                                                            <option value="existing">
                                                                                Keep existing paid
                                                                                term
                                                                            </option>
                                                                        </Show>
                                                                    </select>
                                                                </label>
                                                                <label>
                                                                    Paid invoice reference
                                                                    <input
                                                                        name="invoiceReference"
                                                                        placeholder="Required for a paid annual term"
                                                                    />
                                                                </label>
                                                                <button
                                                                    class="button button--primary"
                                                                    disabled={isPending()}
                                                                >
                                                                    Approve & publish
                                                                </button>
                                                            </form>
                                                        </details>
                                                        <form
                                                            class="editor"
                                                            onSubmit={(event) => {
                                                                event.preventDefault();
                                                                const note = String(
                                                                    new FormData(
                                                                        event.currentTarget,
                                                                    ).get("note"),
                                                                );
                                                                void perform(
                                                                    async () =>
                                                                        (
                                                                            await memberClient()
                                                                        ).mutation(
                                                                            api.jobs.updateStatus,
                                                                            {
                                                                                id: job._id,
                                                                                action: "decline",
                                                                                note,
                                                                            },
                                                                        ),
                                                                    "Review returned to the employer.",
                                                                );
                                                            }}
                                                        >
                                                            <label>
                                                                Review note
                                                                <textarea
                                                                    name="note"
                                                                    required
                                                                    rows="2"
                                                                />
                                                            </label>
                                                            <button
                                                                class="button"
                                                                disabled={isPending()}
                                                            >
                                                                Return for changes
                                                            </button>
                                                        </form>
                                                    </details>
                                                </Show>
                                            </Card>
                                        )}
                                    </For>
                                </section>
                                {/* manage sponsorship requests and paid terms */}
                                <section id="sponsors">
                                    <div class="management-heading">
                                        <h2>Sponsorships</h2>
                                        <a class="button" href="/sponsor">
                                            Request sponsorship
                                        </a>
                                    </div>
                                    <Show when={!current().sponsorships.length}>
                                        <Card title="Your sponsorships">
                                            <p>No sponsorship requests yet.</p>
                                        </Card>
                                    </Show>
                                    <For each={current().sponsorships}>
                                        {(sponsor) => (
                                            <Card
                                                title={
                                                    current().organisations.find(
                                                        (company) =>
                                                            company._id === sponsor.organisationId,
                                                    )?.name ?? "Company"
                                                }
                                                meta={sponsor.status}
                                            >
                                                <p>
                                                    {
                                                        tiers.find(
                                                            (tier) => tier.id === sponsor.tier,
                                                        )?.name
                                                    }{" "}
                                                    · CHF{" "}
                                                    {
                                                        tiers.find(
                                                            (tier) => tier.id === sponsor.tier,
                                                        )?.price
                                                    }
                                                    /year
                                                </p>
                                                <Show when={sponsor.endsAt}>
                                                    <p>
                                                        {date(sponsor.startsAt!)} –{" "}
                                                        {date(sponsor.endsAt!)}
                                                    </p>
                                                </Show>
                                                <Show when={sponsor.note}>
                                                    <p>{sponsor.note}</p>
                                                </Show>
                                                <p class="text-soft">{sponsor.billingEmail}</p>
                                                <Show when={sponsor.status === "requested"}>
                                                    <p>Awaiting payment.</p>
                                                </Show>
                                                <Show when={sponsor.status === "active"}>
                                                    <p>
                                                        {sponsor.endsAt! <= Date.now()
                                                            ? "This term has expired. Request renewal below."
                                                            : "No automatic renewal. The team can extend your term after confirming the next invoice."}
                                                    </p>
                                                </Show>
                                                <Show when={sponsor.renewalRequested}>
                                                    <p>
                                                        Renewal requested. Awaiting invoice payment.
                                                    </p>
                                                </Show>
                                                <Show
                                                    when={
                                                        sponsor.status === "active" &&
                                                        !sponsor.renewalRequested
                                                    }
                                                >
                                                    <button
                                                        class="button"
                                                        disabled={isPending()}
                                                        onClick={() =>
                                                            perform(
                                                                async () =>
                                                                    (await memberClient()).mutation(
                                                                        api.sponsors.updateRequest,
                                                                        {
                                                                            id: sponsor._id,
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
                                                <Show when={sponsor.status === "requested"}>
                                                    <button
                                                        class="button"
                                                        disabled={isPending()}
                                                        onClick={() =>
                                                            perform(
                                                                async () =>
                                                                    (await memberClient()).mutation(
                                                                        api.sponsors.updateRequest,
                                                                        {
                                                                            id: sponsor._id,
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
                                                        sponsor.status === "requested" ||
                                                        sponsor.status === "active"
                                                    }
                                                >
                                                    <CheckoutButton
                                                        purchase={{
                                                            kind: "sponsorship",
                                                            id: sponsor._id,
                                                        }}
                                                        label={
                                                            sponsor.status === "active"
                                                                ? "Renew sponsorship"
                                                                : "Pay sponsorship"
                                                        }
                                                    />
                                                </Show>
                                                <Show when={current().isTeam}>
                                                    <form
                                                        class="editor"
                                                        onSubmit={(event) => {
                                                            event.preventDefault();
                                                            const invoiceReference = String(
                                                                new FormData(
                                                                    event.currentTarget,
                                                                ).get("invoiceReference"),
                                                            );
                                                            void perform(
                                                                async () =>
                                                                    (await memberClient()).mutation(
                                                                        api.sponsors.activate,
                                                                        {
                                                                            id: sponsor._id,
                                                                            invoiceReference,
                                                                        },
                                                                    ),
                                                                "Annual sponsorship activated.",
                                                            );
                                                        }}
                                                    >
                                                        <label>
                                                            Paid invoice reference
                                                            <input
                                                                name="invoiceReference"
                                                                required
                                                            />
                                                        </label>
                                                        <button
                                                            class="button button--primary"
                                                            disabled={isPending()}
                                                        >
                                                            {sponsor.status === "active"
                                                                ? "Confirm renewal payment"
                                                                : "Confirm payment & activate"}
                                                        </button>
                                                    </form>
                                                    <form
                                                        class="editor"
                                                        onSubmit={(event) => {
                                                            event.preventDefault();
                                                            const note = String(
                                                                new FormData(
                                                                    event.currentTarget,
                                                                ).get("note"),
                                                            );
                                                            void perform(
                                                                async () =>
                                                                    (await memberClient()).mutation(
                                                                        api.sponsors.end,
                                                                        { id: sponsor._id, note },
                                                                    ),
                                                                "Sponsorship updated.",
                                                            );
                                                        }}
                                                    >
                                                        <label>
                                                            Decision note
                                                            <textarea
                                                                name="note"
                                                                required
                                                                rows="2"
                                                            />
                                                        </label>
                                                        <button
                                                            class="button"
                                                            disabled={isPending()}
                                                        >
                                                            {sponsor.status === "requested"
                                                                ? "Decline request"
                                                                : "End sponsorship"}
                                                        </button>
                                                    </form>
                                                </Show>
                                            </Card>
                                        )}
                                    </For>
                                </section>
                                {/* edit the companies that own jobs and sponsorships */}
                                <section id="companies">
                                    <h2>Companies</h2>
                                    <For each={current().organisations}>
                                        {(company) => (
                                            <details class="company-editor">
                                                <summary>{company.name}</summary>
                                                <CompanyForm
                                                    isTeam={current().isTeam}
                                                    item={company}
                                                    onSave={refetch}
                                                />
                                            </details>
                                        )}
                                    </For>
                                    <CompanyForm isTeam={current().isTeam} onSave={refetch} />
                                </section>
                            </div>
                        )}
                    </Show>
                </Show>
            </Page>
        </>
    );
}

/** Format workspace dates in the local timezone. */
function date(value: number): string {
    return new Date(value).toLocaleDateString("en-GB", { timeZone });
}
