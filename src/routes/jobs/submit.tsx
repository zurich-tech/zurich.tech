import { jobPrice } from "../../../shared/plans";
import { Show, createSignal } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useEmployerWorkspace } from "../../core/workspace";
import { CompanySelect } from "../../component/company";
import { memberClient } from "../../core/convex";
import { Page } from "../../component/page";
import { Card } from "../../component/card";
import { Seo } from "../../component/seo";
import { FormMessage } from "../../component/form";
import { errorMessage } from "../../core/error";

/** Prepare a vacancy for team review without modifying its published revision. */
export default function Route() {
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
            ).mutation(api.jobs.save, {
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
            window.location.assign("/manage#jobs");
        } catch (caught) {
            setError(errorMessage(caught, "Could not save job."));
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo
                title={params.edit ? "Edit job" : "Post a job"}
                description="Publish a tech vacancy in Zürich."
            />
            <Page width="narrow">
                <Card title={params.edit ? "Edit job" : "Post a job"} heading="h1">
                    <Show
                        when={account.user()}
                        fallback={
                            <a
                                class="button"
                                href={`/sign-in?next=${encodeURIComponent(locationPath(params.edit))}`}
                            >
                                Sign in to post a job
                            </a>
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
                                                <a class="text-link" href="/manage#companies">
                                                    Add your company
                                                </a>{" "}
                                                before posting a job.
                                            </p>
                                        }
                                    >
                                        <form class="editor" onSubmit={submit}>
                                            <CompanySelect
                                                companies={current().organisations}
                                                value={draft()?.organisationId}
                                                isDisabled={!!job()?.publishedAt}
                                            />
                                            <div class="form-columns">
                                                <label>
                                                    Role title
                                                    <input
                                                        name="title"
                                                        required
                                                        maxlength="180"
                                                        value={draft()?.title ?? ""}
                                                    />
                                                </label>
                                                <label>
                                                    URL slug
                                                    <input
                                                        name="slug"
                                                        required
                                                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                                        readonly={!!job()?.publishedAt}
                                                        value={draft()?.slug ?? ""}
                                                    />
                                                </label>
                                            </div>
                                            <label>
                                                Description <span>Markdown supported</span>
                                                <textarea
                                                    name="description"
                                                    required
                                                    rows="12"
                                                    maxlength="50000"
                                                    value={draft()?.description ?? ""}
                                                />
                                            </label>
                                            <label>
                                                Location
                                                <input
                                                    name="location"
                                                    required
                                                    placeholder="Zürich, Switzerland"
                                                    value={draft()?.location ?? ""}
                                                />
                                            </label>
                                            <div class="form-columns">
                                                <label>
                                                    Workplace
                                                    <select
                                                        name="workplace"
                                                        value={draft()?.workplace ?? "hybrid"}
                                                    >
                                                        <option value="onsite">On-site</option>
                                                        <option value="hybrid">Hybrid</option>
                                                        <option value="remote">Remote</option>
                                                    </select>
                                                </label>
                                                <label>
                                                    Employment
                                                    <select
                                                        name="employment"
                                                        value={draft()?.employment ?? "full-time"}
                                                    >
                                                        <option value="full-time">Full-time</option>
                                                        <option value="part-time">Part-time</option>
                                                        <option value="contract">Contract</option>
                                                        <option value="internship">
                                                            Internship
                                                        </option>
                                                    </select>
                                                </label>
                                            </div>
                                            <div class="form-columns">
                                                <label>
                                                    Minimum salary (CHF)
                                                    <input
                                                        name="min"
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={draft()?.salary?.min ?? ""}
                                                    />
                                                </label>
                                                <label>
                                                    Maximum salary (CHF)
                                                    <input
                                                        name="max"
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={draft()?.salary?.max ?? ""}
                                                    />
                                                </label>
                                            </div>
                                            <label>
                                                Salary period
                                                <select
                                                    name="period"
                                                    value={draft()?.salary?.period ?? "year"}
                                                >
                                                    <option value="year">Per year</option>
                                                    <option value="hour">Per hour</option>
                                                </select>
                                            </label>
                                            <label>
                                                Technologies{" "}
                                                <span>Comma-separated, up to twelve</span>
                                                <input
                                                    name="tags"
                                                    value={draft()?.tags.join(", ") ?? ""}
                                                />
                                            </label>
                                            <label>
                                                Application URL
                                                <input
                                                    name="applicationUrl"
                                                    type="url"
                                                    required
                                                    value={draft()?.applicationUrl ?? ""}
                                                />
                                            </label>
                                            <label>
                                                Invoice email
                                                <input
                                                    name="billingEmail"
                                                    type="email"
                                                    required
                                                    value={
                                                        draft()?.billingEmail ??
                                                        account.user()?.email ??
                                                        ""
                                                    }
                                                />
                                            </label>

                                            <p class="text-soft">
                                                CHF {jobPrice} per year, or an included sponsor
                                                listing. The team reviews your submission and
                                                confirms payment before publication. Reconfirm every
                                                90 days that the role is open.
                                            </p>
                                            <FormMessage error={error()} />
                                            <div class="row-actions">
                                                <button
                                                    class="button"
                                                    value="draft"
                                                    disabled={isPending()}
                                                >
                                                    Save draft
                                                </button>
                                                <button
                                                    class="button button--primary"
                                                    value="review"
                                                    disabled={isPending()}
                                                >
                                                    Submit for review
                                                </button>
                                            </div>
                                        </form>
                                    </Show>
                                </Show>
                            )}
                        </Show>
                    </Show>
                </Card>
            </Page>
        </>
    );
}

/** Preserve the edit destination through provider sign-in. */
function locationPath(edit: string | string[] | undefined) {
    return typeof edit === "string"
        ? `/jobs/submit?edit=${encodeURIComponent(edit)}`
        : "/jobs/submit";
}
