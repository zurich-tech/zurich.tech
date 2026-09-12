import { Empty } from "../components/empty";
import { For, Show, Switch, Match, createSignal } from "solid-js";
import { OrganisationLocations } from "./locations";
import { JobCard, SponsorshipCard } from "./employer";
import { CompanyForm } from "./company";
import { useEmployerWorkspace, useWorkspaceCommand } from "../app/workspace";
import { Card } from "../components/card";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Manage organisations, vacancies and sponsorships in the selected panel. */
export function Management(props: {
    section: "jobs" | "sponsors" | "organisations";
    organisationId?: string;
}) {
    const { workspace, refetch } = useEmployerWorkspace();
    const command = useWorkspaceCommand(refetch);
    const [selected, setSelected] = createSignal<string | undefined>(props.organisationId);
    const isCreating = () => selected() === "new";
    const organisation = () => workspace()?.organisations.find((item) => item._id === selected());

    return (
        <>
            <FormMessage
                error={
                    workspace.error
                        ? errorMessage(workspace.error, "Could not load this panel.")
                        : command.error()
                }
                success={command.success()}
            />
            <Show when={workspace()}>
                {(current) => (
                    <Switch>
                        <Match when={props.section === "jobs"}>
                            <Card
                                title="Jobs"
                                toolbar={
                                    <a class="button button--primary" href="/jobs/submit">
                                        New job
                                    </a>
                                }
                            >
                                <Show when={!current().jobs.length}>
                                    <Empty title="No jobs" />
                                </Show>
                                <For each={current().jobs}>
                                    {(job) => (
                                        <JobCard
                                            job={job}
                                            companies={current().organisations}
                                            isTeam={current().isTeam}
                                            isPending={command.isPending()}
                                            perform={command.perform}
                                        />
                                    )}
                                </For>
                            </Card>
                        </Match>
                        <Match when={props.section === "sponsors"}>
                            <Card
                                title="Sponsors"
                                toolbar={
                                    <a class="button button--primary" href="/sponsor">
                                        New sponsorship
                                    </a>
                                }
                            >
                                <Show when={!current().sponsorships.length}>
                                    <Empty title="No sponsors" />
                                </Show>
                                <For each={current().sponsorships}>
                                    {(sponsor) => (
                                        <SponsorshipCard
                                            sponsor={sponsor}
                                            companies={current().organisations}
                                            isTeam={current().isTeam}
                                            isPending={command.isPending()}
                                            perform={command.perform}
                                        />
                                    )}
                                </For>
                            </Card>
                        </Match>
                        <Match when={props.section === "organisations"}>
                            <Card
                                title={
                                    isCreating()
                                        ? "New organisation"
                                        : (organisation()?.name ?? "Organisations")
                                }
                                class={isCreating() || selected() ? undefined : "admin-table-card"}
                                toolbar={
                                    <button
                                        class="button"
                                        classList={{ "button--primary": !selected() }}
                                        onClick={() => {
                                            setSelected(selected() ? undefined : "new");
                                        }}
                                    >
                                        {isCreating() || selected() ? "Cancel" : "New organisation"}
                                    </button>
                                }
                            >
                                <Show
                                    when={isCreating() || selected()}
                                    fallback={
                                        <div class="table-scroll">
                                            <table class="admin-table">
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Website</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <For each={current().organisations}>
                                                        {(organisation) => (
                                                            <tr>
                                                                <td>
                                                                    <a
                                                                        href={`/organisations/${organisation.slug}`}
                                                                    >
                                                                        {organisation.name}
                                                                    </a>
                                                                </td>
                                                                <td>
                                                                    <a
                                                                        href={organisation.website}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        {organisation.website
                                                                            .replace(
                                                                                /^https?:\/\//,
                                                                                "",
                                                                            )
                                                                            .replace(/\/$/, "")}
                                                                    </a>
                                                                </td>
                                                                <td>
                                                                    <div class="admin-actions">
                                                                        <button
                                                                            class="button"
                                                                            onClick={() =>
                                                                                setSelected(
                                                                                    organisation._id,
                                                                                )
                                                                            }
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </For>
                                                </tbody>
                                            </table>
                                        </div>
                                    }
                                >
                                    <CompanyForm
                                        item={organisation()}
                                        isTeam={current().isTeam}
                                        onSave={async () => {
                                            await refetch();
                                            setSelected(undefined);
                                        }}
                                    />
                                    <Show when={organisation()}>
                                        {(item) => (
                                            <OrganisationLocations
                                                organisationId={item()._id}
                                                isTeam={current().isTeam}
                                            />
                                        )}
                                    </Show>
                                </Show>
                            </Card>
                        </Match>
                    </Switch>
                )}
            </Show>
        </>
    );
}
