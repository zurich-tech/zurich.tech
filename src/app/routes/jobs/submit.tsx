import { Loading } from "../../../components/loading";
import { jobPrice, jobDurationMonths } from "../../../sponsorships/plans";
import { Show, createSignal } from "solid-js";
import { useNavigate, revalidate, useSearchParams } from "@solidjs/router";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { useEmployerWorkspace } from "../../workspace";
import { CompanySelect } from "../../../organisations/company";
import { memberClient } from "../../../auth/convex";
import { Page, PageHeader } from "../../page";
import { Card } from "../../../components/card";
import { Seo } from "../../seo";
import { Editor, FormMessage } from "../../../components/form";
import { errorMessage } from "../../../components/errors";

/** Prepare a vacancy for team review without modifying its published revision. */
export default function Route() {
    const navigate = useNavigate();
    // load the owned job and prefer its unpublished revision
    const { account, workspace } = useEmployerWorkspace();
    const [params] = useSearchParams();
    const job = () => workspace()?.jobs.find((item) => item._id === params.edit);
    const draft = () => job()?.draft ?? job();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Save the authored fields and return to their review status. */
    async function submit(event: SubmitEvent) {
        // read the authored vacancy fields
        event.preventDefault();
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        const text = (key: string) => String(fields.get(key) ?? "").trim();
        setIsPending(true);
        setError(undefined);
        try {
            if (!!text("min") !== !!text("max"))
                throw new Error("Enter both ends of the salary range.");

            // save the revision without publishing unreviewed changes
            await (
                await memberClient()
            ).mutation(api.jobs.jobs.save, {
                id: job()?._id,
                submit: (event.submitter as HTMLButtonElement)?.value === "review",
                organisationId: (job()?.publishedAt
                    ? job()!.organisationId
                    : text("organisationId")) as Id<"organisations">,
                billingEmail: text("billingEmail"),
                title: text("title"),
                slug: text("slug"),
                description: text("description"),
                location: text("location"),
                workplace: text("workplace") as "onsite" | "hybrid" | "remote",
                employment: text("employment") as
                    "full-time" | "part-time" | "contract" | "internship",
                salary:
                    text("min") || text("max")
                        ? {
                              min: Number(text("min")),
                              max: Number(text("max")),
                              period: text("period") as "year" | "hour",
                          }
                        : undefined,
                tags: text("tags")
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                applicationUrl: text("applicationUrl"),
            });
            await revalidate();
            navigate("/manage?section=jobs");
        } catch (caught) {
            setError(errorMessage(caught, "Could not save job."));
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo
                title={
                    params.edit
                        ? draft()?.title
                            ? `Edit ${draft()!.title}`
                            : "Edit job"
                        : "Post a job"
                }
                description="Publish a tech vacancy in Zürich."
            />
            <Page>
                <PageHeader
                    title={
                        params.edit
                            ? draft()?.title
                                ? `Edit ${draft()!.title}`
                                : "Edit job"
                            : "Post a job"
                    }
                    actions={
                        <>
                            <Show when={account.user() && workspace()?.organisations.length}>
                                <button
                                    type="submit"
                                    form="job-editor"
                                    value="draft"
                                    class="button"
                                    disabled={isPending()}
                                >
                                    {isPending() ? "Saving…" : "Save"}
                                </button>
                                <button
                                    type="submit"
                                    form="job-editor"
                                    value="review"
                                    class="button button--primary"
                                    disabled={isPending()}
                                >
                                    Submit for review
                                </button>
                            </Show>
                            <a class="button" href="/manage?section=jobs">
                                Back
                            </a>
                        </>
                    }
                />
                <Show
                    when={account.user()}
                    fallback={
                        <Show when={!account.isPending()} fallback={<Loading />}>
                            <a
                                class="button"
                                href={`/sign-in?next=${encodeURIComponent(locationPath(params.edit))}`}
                            >
                                Sign in to post a job
                            </a>
                        </Show>
                    }
                >
                    <Show when={workspace.error}>
                        <p class="form-error">
                            {errorMessage(workspace.error, "Could not load workspace.")}
                        </p>
                    </Show>
                    <Show when={workspace()}>
                        {(current) => (
                            <Show
                                when={!params.edit || job()}
                                fallback={<p>This job was not found in your workspace.</p>}
                            >
                                <Show
                                    when={current().organisations.length > 0}
                                    fallback={
                                        <p>
                                            <a
                                                class="text-link"
                                                href="/manage?section=organisations"
                                            >
                                                Add your company
                                            </a>{" "}
                                            before posting a job.
                                        </p>
                                    }
                                >
                                    <JobForm
                                        draft={draft()}
                                        job={job()}
                                        companies={current().organisations}
                                        isPending={isPending()}
                                        email={account.user()?.email}
                                        error={error()}
                                        onSubmit={submit}
                                    />
                                </Show>
                            </Show>
                        )}
                    </Show>
                </Show>
            </Page>
        </>
    );
}

/** Edit the vacancy fields and request publication review. */
function JobForm(props: {
    /** Editable vacancy fields. */
    draft: Doc<"jobs">["draft"] | Doc<"jobs"> | undefined;
    /** Existing published vacancy, if any. */
    job: Doc<"jobs"> | undefined;
    /** Companies available to the employer. */
    companies: { _id: string; name: string }[];
    /** Disable submission while saving. */
    isPending: boolean;
    /** Signed-in account email. */
    email: string | undefined;
    /** Submission failure. */
    error: string | undefined;
    /** Save the authored revision. */
    onSubmit: (event: SubmitEvent) => Promise<void>;
}) {
    return (
        <Editor
            id="job-editor"
            class="editor"
            onSubmit={props.onSubmit}
            actions={() => (
                <div class="row-actions">
                    <button class="button" value="draft" disabled={props.isPending}>
                        {props.isPending ? "Saving…" : "Save"}
                    </button>
                    <button
                        class="button button--primary"
                        value="review"
                        disabled={props.isPending}
                    >
                        {props.isPending ? "Saving…" : "Submit for review"}
                    </button>
                </div>
            )}
        >
            <div class="editor-columns">
                <div class="editor-column">
                    <Card title="Job">
                        <div class="form-columns">
                            <label>
                                Title
                                <input
                                    name="title"
                                    required
                                    maxlength="180"
                                    value={props.draft?.title ?? ""}
                                />
                            </label>
                            <label>
                                Slug
                                <input
                                    name="slug"
                                    required
                                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                    readonly={!!props.job?.publishedAt}
                                    value={props.draft?.slug ?? ""}
                                />
                            </label>
                        </div>
                        <label>
                            Description <span>Markdown supported</span>
                            <textarea
                                name="description"
                                required
                                rows="8"
                                maxlength="50000"
                                value={props.draft?.description ?? ""}
                            />
                        </label>
                        <label>
                            Technologies <span>Comma-separated, up to twelve</span>
                            <input name="tags" value={props.draft?.tags.join(", ") ?? ""} />
                        </label>
                        <label>
                            Application URL
                            <input
                                name="applicationUrl"
                                type="url"
                                required
                                value={props.draft?.applicationUrl ?? ""}
                            />
                        </label>
                    </Card>
                </div>
                <aside class="editor-column">
                    <Card title="Details">
                        <CompanySelect
                            companies={props.companies}
                            value={props.draft?.organisationId}
                            isDisabled={!!props.job?.publishedAt}
                        />
                        <label>
                            Location
                            <input
                                name="location"
                                required
                                placeholder="Zürich, Switzerland"
                                value={props.draft?.location ?? ""}
                            />
                        </label>
                        <div class="form-columns">
                            <label>
                                Workplace
                                <select name="workplace" value={props.draft?.workplace ?? "hybrid"}>
                                    <option value="onsite">On-site</option>
                                    <option value="hybrid">Hybrid</option>
                                    <option value="remote">Remote</option>
                                </select>
                            </label>
                            <label>
                                Employment
                                <select
                                    name="employment"
                                    value={props.draft?.employment ?? "full-time"}
                                >
                                    <option value="full-time">Full-time</option>
                                    <option value="part-time">Part-time</option>
                                    <option value="contract">Contract</option>
                                    <option value="internship">Internship</option>
                                </select>
                            </label>
                        </div>
                    </Card>
                    <Card title="Salary">
                        <div class="form-columns">
                            <label>
                                Minimum salary (CHF)
                                <input
                                    name="min"
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={props.draft?.salary?.min ?? ""}
                                />
                            </label>
                            <label>
                                Maximum salary (CHF)
                                <input
                                    name="max"
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={props.draft?.salary?.max ?? ""}
                                />
                            </label>
                        </div>
                        <label>
                            Salary period
                            <select name="period" value={props.draft?.salary?.period ?? "year"}>
                                <option value="year">Per year</option>
                                <option value="hour">Per hour</option>
                            </select>
                        </label>
                    </Card>
                    <Card title="Listing">
                        <label>
                            Invoice email
                            <input
                                name="billingEmail"
                                type="email"
                                required
                                value={props.draft?.billingEmail ?? props.email ?? ""}
                            />
                        </label>

                        <p>
                            CHF {jobPrice} · {jobDurationMonths} months. Included for sponsors.
                        </p>
                        <p class="text-soft">
                            Reviewed before publication. Reconfirm every 90 days.
                        </p>
                    </Card>
                </aside>
            </div>
            <FormMessage error={props.error} />
        </Editor>
    );
}

/** Preserve the edit destination through provider sign-in. */
function locationPath(edit: string | string[] | undefined) {
    return typeof edit === "string"
        ? `/jobs/submit?edit=${encodeURIComponent(edit)}`
        : "/jobs/submit";
}
