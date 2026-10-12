import { Select } from "../components/field";
import { Editor, savedEditor } from "../components/form";
import { useConfirmation } from "../components/dialog";
export { SponsorshipCard } from "../sponsorships/editor";
import { Show, createSignal } from "solid-js";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { jobPrice, jobDurationDays } from "../sponsorships/plans";
import { timeZone } from "../app/site";
import { memberClient } from "../auth/convex";
import type { Perform } from "../app/workspace";
import { Card } from "../components/card";
import { InvoiceButton } from "../billing/payments";

/** Owned companies, vacancies and sponsorship agreements. */
type EmployerWorkspace = FunctionReturnType<typeof api.organisations.workspace.employer>;

/** Manage a vacancy and review its pending changes. */
export function JobCard(props: {
    /** Vacancy and its unpublished revision. */
    job: EmployerWorkspace["jobs"][number];
    /** Company identities displayed in the card. */
    companies: EmployerWorkspace["organisations"];
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
                <a class="action-link" href={`/jobs/submit?edit=${props.job._id}&preview=1`}>
                    Preview
                </a>
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
        </Card>
    );
}

/** Review a vacancy and allocate its publication funding. */
export function JobReview(props: {
    /** Vacancy and pending editorial revision. */
    job: EmployerWorkspace["jobs"][number];
    /** Disable controls during a workspace command. */
    isPending: boolean;
    /** Apply the review and refresh the vacancy. */
    perform: Perform;
}) {
    const confirm = useConfirmation();
    const [funding, setFunding] = createSignal(
        props.job.expiresAt && props.job.expiresAt > Date.now()
            ? "existing"
            : props.job.allowance
              ? "sponsor"
              : "invoice",
    );

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
                description:
                    props.job.allowance &&
                    props.job.allowance.startsAt > Date.now() &&
                    fields.get("funding") === "sponsor"
                        ? "Publish this job early under the publicly recognised sponsorship. The agreement dates and payment status stay unchanged."
                        : "Publish this listing and apply the selected funding.",
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
        <Card
            title="Publication"
            class="editor-publication job-publication"
            toolbar={
                <Show when={props.job.publishedAt}>
                    <a class="action-link" href={`/jobs/${props.job.slug}`}>
                        View listing
                    </a>
                </Show>
            }
        >
            <Show
                when={props.job.status !== "published" || props.job.draft}
                fallback={<p class="text-soft">Published. Save a new revision to make changes.</p>}
            >
                <Show
                    when={props.job.allowance}
                    fallback={<p class="text-soft">A paid listing is required.</p>}
                >
                    {(allowance) => (
                        <p class="text-soft">
                            {allowance().available === null
                                ? "Unlimited"
                                : `${allowance().available} of ${allowance().limit}`}{" "}
                            sponsorship slots available
                        </p>
                    )}
                </Show>
                <Editor class="editor" onSubmit={publish}>
                    <label>
                        Funding
                        <Select
                            name="funding"
                            value={funding()}
                            onChange={(event) => setFunding(event.currentTarget.value)}
                        >
                            <option value="invoice">
                                Paid invoice · CHF {jobPrice} / {jobDurationDays} days
                            </option>
                            <option
                                value="sponsor"
                                disabled={
                                    !props.job.allowance || props.job.allowance.available === 0
                                }
                            >
                                {props.job.allowance && props.job.allowance.startsAt > Date.now()
                                    ? "Publish early · recognised sponsorship"
                                    : "Included sponsorship slot"}
                            </option>
                            <Show when={props.job.expiresAt! > Date.now()}>
                                <option value="existing">Keep existing term</option>
                            </Show>
                        </Select>
                    </label>
                    <Show when={funding() === "invoice"}>
                        <label>
                            Paid invoice reference
                            <input name="invoiceReference" required />
                        </label>
                    </Show>
                    <div class="form-actions">
                        <button class="button button--primary" disabled={props.isPending}>
                            {props.job.publishedAt ? "Publish changes" : "Approve & publish"}
                        </button>
                    </div>
                </Editor>
                <details class="job-publication-return">
                    <summary class="action-link">Return for changes</summary>
                    <Editor class="editor" onSubmit={decline}>
                        <label>
                            Review note
                            <textarea name="note" required rows="3" />
                        </label>
                        <div class="form-actions">
                            <button class="button" disabled={props.isPending}>
                                Return for changes
                            </button>
                        </div>
                    </Editor>
                </details>
            </Show>
        </Card>
    );
}

/** Format workspace dates in the local timezone. */
function date(value: number): string {
    return new Date(value).toLocaleDateString("en-GB", { timeZone });
}
