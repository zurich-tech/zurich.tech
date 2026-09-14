import { Editor, savedEditor } from "../components/form";
import { useConfirmation } from "../components/dialog";
export { SponsorshipCard } from "../sponsorships/editor";
import { Show, createSignal } from "solid-js";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { jobPrice, jobDurationMonths } from "../sponsorships/plans";
import { timeZone } from "../app/site";
import { memberClient } from "../auth/convex";
import type { Perform } from "../app/workspace";
import { Card } from "../components/card";
import { InvoiceButton } from "../billing/payments";
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
    isAdmin: boolean;
    /** Disable actions while a workspace command is pending. */
    isPending: boolean;
    /** Run a command and refresh its visible result. */
    perform: Perform;
}) {
    const confirm = useConfirmation();
    const status = () =>
        ({
            draft: "Draft",
            review: "In review",
            published: "Published",
            closed: "Closed",
            expired: "Expired",
            unconfirmed: "Needs confirmation",
        })[props.job.displayStatus];
    const hasFunding = () => !!props.job.expiresAt && props.job.expiresAt > Date.now();

    return (
        <Card
            title={props.job.title}
            meta={
                props.job.draft
                    ? `${status()} · ${props.job.draftStatus === "review" ? "Changes in review" : "Draft changes"}`
                    : status()
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
            <Show when={props.job.displayStatus === "unconfirmed"}>
                <p class="form-error">Hidden until you confirm this role is still open.</p>
            </Show>
            <div class="admin-actions">
                <Show
                    when={
                        props.job.status !== "draft" &&
                        props.job.status !== "closed" &&
                        !hasFunding()
                    }
                >
                    <InvoiceButton
                        name={`Job listing: ${props.job.title}`}
                        reference={props.job._id}
                    />
                </Show>
                <a class="action-link" href={`/jobs/submit?edit=${props.job._id}`}>
                    Edit
                </a>
                <Show when={props.job.publishedAt}>
                    <a class="action-link" href={`/jobs/${props.job.slug}`}>
                        View
                    </a>
                </Show>
                <Show when={props.job.status === "published" && hasFunding()}>
                    <button
                        class="button"
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
                        class="button"
                        disabled={props.isPending}
                        onClick={() =>
                            props.perform(async () => {
                                if (
                                    !(await confirm({
                                        title: "Close job listing",
                                        action: "Close listing",
                                        description: "Remove this job from public listings.",
                                        isDestructive: true,
                                        emails: 0,
                                    }))
                                )
                                    return false;
                                await (
                                    await memberClient()
                                ).mutation(api.jobs.jobs.updateStatus, {
                                    id: props.job._id,
                                    action: "close",
                                });
                            }, "Listing closed.")
                        }
                    >
                        Close listing
                    </button>
                </Show>
            </div>
            <Show when={props.isAdmin}>
                <JobReview job={props.job} isPending={props.isPending} perform={props.perform} />
            </Show>
        </Card>
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
    const confirm = useConfirmation();
    const [funding, setFunding] = createSignal("invoice");

    /** Publish the reviewed vacancy with its funding. */
    async function publish(event: SubmitEvent) {
        // read the submitted review fields
        event.preventDefault();
        const editor = event.currentTarget as HTMLFormElement;
        const fields = new FormData(event.currentTarget as HTMLFormElement);

        if (
            !(await confirm({
                title: "Publish job",
                action: "Publish job",
                description: "Publish this listing and apply the selected funding.",
                emails: 0,
            }))
        )
            return;
        // apply the decision and refresh the workspace
        void props.perform(async () => {
            await (
                await memberClient()
            ).mutation(api.jobs.jobs.publish, {
                id: props.job._id,
                funding: String(fields.get("funding")) as "existing" | "invoice" | "sponsor",
                invoiceReference: String(fields.get("invoiceReference") ?? "") || undefined,
            });
            savedEditor(editor);
        }, "Job published.");
    }

    /** Return the vacancy to its author with a review note. */
    async function decline(event: SubmitEvent) {
        // read the submitted review fields
        event.preventDefault();
        const editor = event.currentTarget as HTMLFormElement;
        const note = String(new FormData(event.currentTarget as HTMLFormElement).get("note"));

        if (
            !(await confirm({
                title: "Return job for changes",
                action: "Return for changes",
                description: "Return this listing to its author with your review note.",
                emails: 0,
            }))
        )
            return;
        // apply the decision and refresh the workspace
        void props.perform(async () => {
            await (
                await memberClient()
            ).mutation(api.jobs.jobs.updateStatus, {
                id: props.job._id,
                action: "decline",
                note,
            });
            savedEditor(editor);
        }, "Review returned to the employer.");
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
                <Editor class="editor" onSubmit={publish}>
                    <label>
                        Funding
                        <select
                            name="funding"
                            value={funding()}
                            onChange={(event) => setFunding(event.currentTarget.value)}
                        >
                            <option value="invoice">
                                Paid invoice · CHF {jobPrice} / {jobDurationMonths} months
                            </option>
                            <option value="sponsor">Included sponsorship slot</option>
                            <Show when={props.job.expiresAt! > Date.now()}>
                                <option value="existing">Keep existing paid term</option>
                            </Show>
                        </select>
                    </label>
                    <Show when={funding() === "invoice"}>
                        <label>
                            Paid invoice reference
                            <input name="invoiceReference" required />
                        </label>
                    </Show>
                    <button class="button button--primary" disabled={props.isPending}>
                        Approve & publish
                    </button>
                </Editor>
            </details>
            <Editor class="editor" onSubmit={decline}>
                <label>
                    Review note
                    <textarea name="note" required rows="2" />
                </label>
                <button class="button" disabled={props.isPending}>
                    Return for changes
                </button>
            </Editor>
        </details>
    );
}

/** Format workspace dates in the local timezone. */
function date(value: number): string {
    return new Date(value).toLocaleDateString("en-GB", { timeZone });
}
