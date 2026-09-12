import { Loading } from "../../components/loading";
import { createResource, Show, Switch, Match, For } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../../../convex/_generated/api";
import { useAccount } from "../../auth/index";
import { memberClient } from "../../auth/convex";
import { errorMessage } from "../../components/errors";
import { Page } from "../page";
import { Card } from "../../components/card";
import { Seo } from "../seo";
import { EventAdmin } from "../../events/workspace";
import { Attendees } from "../../events/attendees";
import { SeriesAdmin } from "../../events/series";
import { Management } from "../../organisations/management";
import { Team, NewsletterAdmin } from "../../members/workspace";

/** Team-only workspace tabs. */
const teamTabs = [
    { id: "organisations", label: "Organisations" },
    { id: "jobs", label: "Jobs" },
    { id: "sponsors", label: "Sponsors" },
    { id: "series", label: "Series" },
    { id: "people", label: "Team" },
    { id: "email", label: "Email" },
] as const;

/** Route signed in organisers to their event and team controls. */
export default function Route() {
    // load only the signed in account’s event workspace
    const account = useAccount();
    const [params, setParams] = useSearchParams();
    const section = () => (typeof params.section === "string" ? params.section : "events");
    const [access] = createResource(
        () => account.user()?.id,
        async () => (await memberClient()).query(api.auth.queries.current, {}),
    );
    const [workspace, { refetch }] = createResource(
        () => access()?.isTeam,
        async () => (await memberClient()).query(api.events.workspace.events, {}),
    );

    return (
        <>
            <Seo title="Admin" description="Manage events and registrations." />
            <Page class="admin-page">
                <Card title="Admin" heading="h1" class="admin-navigation">
                    <Show when={access()?.isTeam}>
                        {/* select one workspace section without loading hidden panels */}
                        <nav class="filter-bar admin-tabs" aria-label="Admin sections">
                            <button
                                classList={{ active: section() === "events" }}
                                aria-pressed={section() === "events"}
                                onClick={() => {
                                    setParams({
                                        section: undefined,
                                        event: undefined,
                                        organisation: undefined,
                                    });
                                }}
                            >
                                Events
                            </button>
                            <Show when={access()?.isTeam}>
                                <For each={teamTabs}>
                                    {(tab) => (
                                        <button
                                            classList={{ active: section() === tab.id }}
                                            aria-pressed={section() === tab.id}
                                            onClick={() => {
                                                setParams({
                                                    section: tab.id,
                                                    event: undefined,
                                                    organisation: undefined,
                                                });
                                            }}
                                        >
                                            {tab.label}
                                        </button>
                                    )}
                                </For>
                            </Show>
                        </nav>
                    </Show>
                </Card>
                <Show
                    when={account.user()}
                    fallback={
                        <Show when={!account.isPending()} fallback={<Loading />}>
                            <a class="button" href="/sign-in?next=%2Fadmin">
                                Sign in to manage the site
                            </a>
                        </Show>
                    }
                >
                    <Show when={access.error}>
                        <p class="form-error" role="alert">
                            {errorMessage(access.error, "Could not load your account.")}
                        </p>
                    </Show>
                    <Show when={access() && !access()?.isTeam}>
                        <a class="button" href="/manage">
                            Manage your organisations
                        </a>
                    </Show>
                    <Show when={workspace.error}>
                        <p class="form-error" role="alert">
                            {errorMessage(workspace.error, "Could not load admin controls.")}
                        </p>
                    </Show>
                    <Show when={workspace()}>
                        {(current) => (
                            <>
                                <Switch>
                                    <Match when={section() === "events"}>
                                        <Show
                                            when={
                                                typeof params.event === "string"
                                                    ? params.event
                                                    : undefined
                                            }
                                            fallback={
                                                <EventAdmin
                                                    workspace={current()}
                                                    refresh={refetch}
                                                />
                                            }
                                        >
                                            {(eventId) => <Attendees eventId={eventId()} />}
                                        </Show>
                                    </Match>
                                    <Match
                                        when={
                                            section() === "jobs" ||
                                            section() === "sponsors" ||
                                            section() === "organisations"
                                        }
                                    >
                                        <Management
                                            organisationId={
                                                typeof params.organisation === "string"
                                                    ? params.organisation
                                                    : undefined
                                            }
                                            section={
                                                section() as "jobs" | "sponsors" | "organisations"
                                            }
                                        />
                                    </Match>
                                    <Match when={section() === "series"}>
                                        <SeriesAdmin />
                                    </Match>
                                    <Match when={access()?.isTeam && section() === "people"}>
                                        <Team people={current().people} refresh={refetch} />
                                    </Match>
                                    <Match when={access()?.isTeam && section() === "email"}>
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
