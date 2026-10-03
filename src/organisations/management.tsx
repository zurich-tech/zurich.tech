import { Empty } from "../components/empty";
import { startTransition, For, Show, Switch, Match, createMemo, createSignal } from "solid-js";
import { OrganisationLocations } from "./locations";
import { JobCard, SponsorshipCard } from "./employer";
import { CompanyForm } from "./company";
import { useEmployerWorkspace, useWorkspaceCommand } from "../app/workspace";
import { Card } from "../components/card";
import { FormMessage, leaveEditor } from "../components/form";
import { errorMessage } from "../components/errors";
import { TableToolbar } from "../components/toolbar";

/** Manage organisations, vacancies and sponsorships in the selected panel. */
export function Management(props: {
    section: "jobs" | "sponsors" | "organisations";
    organisationId?: string;
}) {
    const { workspace, refetch } = useEmployerWorkspace(() => props.section === "organisations");
    const command = useWorkspaceCommand(refetch);
    const [selected, setSelected] = createSignal<string | undefined>(props.organisationId);
    const [isSaving, setIsSaving] = createSignal(false);
    const [search, setSearch] = createSignal("");
    const organisations = createMemo(() => {
        const query = search().trim().toLowerCase();

        return (
            workspace()?.organisations.filter((item) =>
                `${item.name} ${item.website}`.toLowerCase().includes(query),
            ) ?? []
        );
    });
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
                                    <a class="action-link" href="/jobs/submit">
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
                                    <a class="action-link" href="/sponsor">
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
                                            isAdmin={current().isAdmin}
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
                                    <>
                                        <Show when={organisation() && current().isAdmin}>
                                            <a
                                                class="action-link"
                                                href={`/jobs/submit?organisation=${organisation()!._id}`}
                                            >
                                                Add job
                                            </a>
                                        </Show>
                                        <Show when={selected()}>
                                            <button
                                                type="submit"
                                                form="organisation-editor"
                                                class="button button--primary"
                                                disabled={isSaving()}
                                            >
                                                {isSaving() ? "Saving…" : "Save"}
                                            </button>
                                        </Show>
                                        <button
                                            class="action-link"
                                            onClick={async () => {
                                                if (!(await leaveEditor())) return;
                                                setSelected(selected() ? undefined : "new");
                                            }}
                                        >
                                            {isCreating() || selected()
                                                ? "Back"
                                                : "New organisation"}
                                        </button>
                                    </>
                                }
                            >
                                <Show
                                    when={isCreating() || selected()}
                                    fallback={
                                        <>
                                            <TableToolbar
                                                value={search()}
                                                onSearch={setSearch}
                                                placeholder="Search organisations…"
                                            />
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
                                                        <For each={organisations()}>
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
                                                                            href={
                                                                                organisation.website
                                                                            }
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
                                                                                class="action-link"
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
                                                <Show when={!organisations().length}>
                                                    <Empty title="No matching organisations" />
                                                </Show>
                                            </div>
                                        </>
                                    }
                                >
                                    <CompanyForm
                                        isPending={isSaving()}
                                        setIsPending={setIsSaving}
                                        item={organisation()}
                                        isAdmin={current().isAdmin}
                                        owners={current().owners}
                                        onSave={async (id) => {
                                            await startTransition(refetch);
                                            setSelected(id);
                                        }}
                                    />
                                </Show>
                            </Card>
                            <Show when={organisation()}>
                                {(item) => <OrganisationLocations organisationId={item()._id} />}
                            </Show>
                        </Match>
                    </Switch>
                )}
            </Show>
        </>
    );
}
