import { JobForm } from "../../../jobs/editor";
import { JobReview } from "../../../organisations/employer";
import { useWorkspaceCommand } from "../../workspace";
import { JobDetails } from "../../../jobs/details";
import type { Job } from "../../../jobs/queries";
import { Loading } from "../../../components/loading";
import { Show, createSignal } from "solid-js";
import { useNavigate, revalidate, useSearchParams } from "@solidjs/router";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useEmployerWorkspace } from "../../workspace";
import { memberClient } from "../../../auth/convex";
import { Page, PageHeader } from "../../page";
import { Seo } from "../../seo";
import { savedEditor, FormMessage } from "../../../components/form";
import { errorMessage } from "../../../components/errors";

/** Prepare a vacancy for team review without modifying its published revision. */
export default function Route() {
    const navigate = useNavigate();
    // load the owned job and prefer its unpublished revision
    const { account, workspace, refetch } = useEmployerWorkspace();
    const command = useWorkspaceCommand(refetch);
    const [params] = useSearchParams();
    const job = () => workspace()?.jobs.find((item) => item._id === params.edit);
    const draft = () => job()?.draft ?? job();
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Save the authored fields and return to their review status. */
    async function submit(event: SubmitEvent) {
        // read the authored vacancy fields
        event.preventDefault();
        const editor = event.currentTarget as HTMLFormElement;
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        const text = (key: string) => String(fields.get(key) ?? "").trim();
        setIsPending(true);
        setError(undefined);
        try {
            const range = (name: string) =>
                text(`${name}Min`) || text(`${name}Max`)
                    ? {
                          min: text(`${name}Min`) ? Number(text(`${name}Min`)) : undefined,
                          max: text(`${name}Max`) ? Number(text(`${name}Max`)) : undefined,
                      }
                    : undefined;
            const salary = range("salary");
            const equity = range("equity");

            // save the revision without publishing unreviewed changes
            const id = await (
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
                summary: text("summary"),
                locations: JSON.parse(text("locations")),
                workplace: text("workplace") as "onsite" | "hybrid" | "remote",
                remoteEligibility:
                    text("workplace") === "onsite"
                        ? undefined
                        : text("remoteEligibility") || undefined,
                engagement: text("engagement") as
                    "employment" | "internship" | "apprenticeship" | "freelance",
                duration:
                    text("duration") === "permanent"
                        ? { kind: "permanent" }
                        : text("duration") === "fixed"
                          ? {
                                kind: "fixed",
                                months: text("months") ? Number(text("months")) : undefined,
                            }
                          : undefined,
                workload: range("workload"),
                compensation:
                    salary || equity
                        ? {
                              salary: salary
                                  ? {
                                        amount: salary,
                                        currency: text("currency"),
                                        period: text("period") as "year" | "month" | "day" | "hour",
                                        basis: text("basis") as "full-time" | "workload",
                                    }
                                  : undefined,
                              equity,
                          }
                        : undefined,
                topics: fields.getAll("topic").map(String),
                skills: text("skills")
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                languages: text("languages")
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                seniority: (text("seniority") || undefined) as
                    "junior" | "mid" | "senior" | "lead" | undefined,
                visaSponsorship: text("visa") === "" ? undefined : text("visa") === "yes",
                application:
                    text("applicationKind") === "email"
                        ? {
                              kind: "email",
                              email: text("applicationEmail"),
                              subject: text("applicationSubject") || undefined,
                          }
                        : { kind: "url", url: text("applicationUrl") },
                applicationDeadline: text("deadline")
                    ? Date.parse(`${text("deadline")}T23:59:59Z`)
                    : undefined,
            });
            savedEditor(editor);
            await revalidate();
            await refetch();
            navigate(
                (event.submitter as HTMLButtonElement)?.value === "preview"
                    ? `/jobs/submit?edit=${id}&preview=1`
                    : "/manage?section=jobs",
            );
        } catch (caught) {
            setError(errorMessage(caught, "Could not save job."));
        } finally {
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
                description="Publish a tech vacancy in Zurich."
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
                            <Show
                                when={
                                    !params.preview &&
                                    account.user() &&
                                    workspace()?.organisations.length
                                }
                            >
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
                                    value={workspace()?.isAdmin ? "preview" : "review"}
                                    class="button button--primary"
                                    disabled={isPending()}
                                >
                                    {workspace()?.isAdmin ? "Save & preview" : "Submit for review"}
                                </button>
                            </Show>
                            <a class="action-link" href="/manage?section=jobs">
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
                                    <Show
                                        when={params.preview && job()}
                                        fallback={
                                            <JobForm
                                                isAdmin={current().isAdmin}
                                                draft={draft()}
                                                job={job()}
                                                companies={current().organisations}
                                                isPending={isPending()}
                                                email={account.user()?.email}
                                                organisationId={
                                                    typeof params.organisation === "string"
                                                        ? params.organisation
                                                        : undefined
                                                }
                                                error={error()}
                                                onSubmit={submit}
                                            />
                                        }
                                    >
                                        <p class="text-soft">Preview · saved revision</p>
                                        <a
                                            class="action-link"
                                            href={`/jobs/submit?edit=${job()!._id}`}
                                        >
                                            Continue editing
                                        </a>
                                        <JobDetails
                                            isPreview
                                            job={
                                                {
                                                    ...draft()!,
                                                    id: job()!._id,
                                                    publishedAt: job()!.publishedAt ?? Date.now(),
                                                    isOpen: false,
                                                    company: current().organisations.find(
                                                        (company) =>
                                                            company._id === draft()!.organisationId,
                                                    )!,
                                                } as Job
                                            }
                                        />
                                        <Show when={current().isAdmin}>
                                            <JobReview
                                                job={job()!}
                                                isPending={command.isPending()}
                                                perform={command.perform}
                                            />
                                        </Show>
                                        <FormMessage
                                            error={command.error()}
                                            success={command.success()}
                                        />
                                    </Show>
                                </Show>
                            </Show>
                        )}
                    </Show>
                </Show>
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
