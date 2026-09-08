import { createResource, createSignal, Show, Switch, Match, For } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../../convex/_generated/api";
import { useAccount } from "../core/auth";
import { memberClient } from "../core/convex";
import { errorMessage } from "../core/error";
import { Page, PageHeader } from "../component/page";
import { Seo } from "../component/seo";
import { EventAdmin } from "../component/admin/events";
import { Attendees } from "../component/admin/attendees";
import { Catalogue } from "../component/admin/catalogue";
import { Organisers, NewsletterAdmin } from "../component/admin/settings";

/** Team-only workspace tabs. */
const teamTabs = [
    { id: "organisations", label: "Organisations" },
    { id: "series", label: "Series" },
    { id: "people", label: "Organisers" },
    { id: "email", label: "Weekly email" },
] as const;

/** Route signed in organisers to their event and team controls. */
export default function Route() {
    // load only the signed in account’s event workspace
    const account = useAccount();
    const [params] = useSearchParams();
    const [section, setSection] = createSignal("events");
    const [workspace, { refetch }] = createResource(
        () => account.user()?.id,
        async () => (await memberClient()).query(api.workspace.events, {}),
    );

    return (
        <>
            <Seo title="Workspace" description="Manage events and registrations." />
            <Page>
                <PageHeader title="Workspace" />
                <div class="row-actions">
                    <a href="/manage">Jobs & sponsors</a>
                    <a href="/settings">Account settings</a>
                </div>
                <Show
                    when={account.user()}
                    fallback={
                        <a class="button" href="/sign-in?next=%2Fadmin">
                            Sign in to your workspace
                        </a>
                    }
                >
                    <Show when={workspace.error}>
                        <p class="form-error" role="alert">
                            {errorMessage(workspace.error, "Could not load your workspace.")}
                        </p>
                    </Show>
                    <Show when={workspace()}>
                        {(current) => (
                            <>
                                {/* select one workspace section without loading hidden panels */}
                                <nav class="filter-bar">
                                    <button
                                        classList={{ active: section() === "events" }}
                                        onClick={() => setSection("events")}
                                    >
                                        Events
                                    </button>
                                    <Show when={current().viewer.isTeam}>
                                        <For each={teamTabs}>
                                            {(tab) => (
                                                <button
                                                    classList={{ active: section() === tab.id }}
                                                    onClick={() => setSection(tab.id)}
                                                >
                                                    {tab.label}
                                                </button>
                                            )}
                                        </For>
                                    </Show>
                                    <a class="button button--primary" href="/submit">
                                        + New event
                                    </a>
                                </nav>
                                <Switch>
                                    <Match when={section() === "events"}>
                                        <EventAdmin workspace={current()} refresh={refetch} />
                                        <Show
                                            when={
                                                typeof params.event === "string"
                                                    ? params.event
                                                    : undefined
                                            }
                                        >
                                            {(eventId) => <Attendees eventId={eventId()} />}
                                        </Show>
                                    </Match>
                                    <Match
                                        when={
                                            current().viewer.isTeam &&
                                            (section() === "organisations" ||
                                                section() === "series")
                                        }
                                    >
                                        <Catalogue
                                            section={
                                                section() === "series" ? "series" : "organisations"
                                            }
                                        />
                                    </Match>
                                    <Match when={current().viewer.isTeam && section() === "people"}>
                                        <Organisers people={current().people} refresh={refetch} />
                                    </Match>
                                    <Match when={current().viewer.isTeam && section() === "email"}>
                                        <NewsletterAdmin
                                            isPaused={current().digest?.isPaused ?? false}
                                            refresh={refetch}
                                        />
                                    </Match>
                                </Switch>
                            </>
                        )}
                    </Show>
                </Show>
            </Page>
        </>
    );
}
