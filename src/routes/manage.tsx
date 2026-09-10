import { OrganisationLocations } from "../component/locations";
import { JobCard, SponsorshipCard } from "../component/employer";
import { Show, For } from "solid-js";
import { useEmployerWorkspace, useWorkspaceCommand } from "../core/workspace";
import { CompanyForm } from "../component/company";
import { Page, PageHeader } from "../component/page";
import { Card } from "../component/card";
import { Seo } from "../component/seo";
import { FormMessage } from "../component/form";
import { errorMessage } from "../core/error";

/** Manage company profiles, reviewed jobs, invoices and sponsorship terms. */
export default function Route() {
    const { account, workspace, refetch } = useEmployerWorkspace();
    const { error, success, isPending, perform } = useWorkspaceCommand(refetch);

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
                                            <JobCard
                                                job={job}
                                                companies={current().organisations}
                                                isTeam={current().isTeam}
                                                isPending={isPending()}
                                                perform={perform}
                                            />
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
                                            <SponsorshipCard
                                                sponsor={sponsor}
                                                companies={current().organisations}
                                                isTeam={current().isTeam}
                                                isPending={isPending()}
                                                perform={perform}
                                            />
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
                                                <OrganisationLocations
                                                    organisationId={company._id}
                                                    isTeam={current().isTeam}
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
