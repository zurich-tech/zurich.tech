import { TopicsAdmin } from "../../topics/admin";
import { Audience } from "../../members/demographics";
import { SectionTabs } from "../../components/section-tabs";
import { NewsAdmin } from "../../news/workspace";
import { Loading } from "../../components/loading";
import { createResource, Show, Switch, Match, Suspense } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { api } from "../../../convex/_generated/api";
import { useAccess } from "../../auth/edit";
import { AccessManager } from "../../auth/management";
import { memberClient } from "../../auth/convex";
import { Page } from "../page";
import { Card } from "../../components/card";
import { Seo } from "../seo";
import { EventAdmin } from "../../events/workspace";
import { Attendees } from "../../events/attendees";
import { Schedules } from "../../events/schedules";
import { SeriesAdmin } from "../../events/series";
import { Management } from "../../organisations/management";
import { EmailAdmin } from "../../mail/workspace";
import { Referrals } from "../../statistics/referrals";

const adminTabs = [
    { id: "audience", label: "Audience" },
    { id: "jobs", label: "Jobs" },
    { id: "sponsors", label: "Sponsors" },
    { id: "people", label: "Access" },
    { id: "email", label: "Email" },
    { id: "traffic", label: "Traffic" },
];

/** Public content workspaces shared by the team and administrators. */
const teamTabs = [
    { id: "topics", label: "Topics" },
    { id: "news", label: "News" },
    { id: "organisations", label: "Organisations" },
];

/** Load only the selected panel, with server-enforced scoped access. */
export default function Route() {
    const access = useAccess();
    const isTeam = () => access.current()?.isAdmin || access.current()?.isTeam;
    const [params, setParams] = useSearchParams();
    const section = () => (typeof params.section === "string" ? params.section : "events");
    const tabs = () => [
        { id: "events", label: "Events" },
        ...(isTeam() || access.current()?.grants.some((grant) => grant.scope.kind === "series")
            ? [{ id: "series", label: "Series" }]
            : []),
        ...(isTeam() ? teamTabs : []),
        ...(access.current()?.isAdmin ? adminTabs : []),
    ];
    /** Leave record-specific views when switching workspaces. */
    function selectSection(id: string) {
        setParams({
            section: id === "events" ? undefined : id,
            event: undefined,
            organisation: undefined,
            series: undefined,
            schedule: undefined,
            source: undefined,
            mail: undefined,
        });
    }

    return (
        <>
            <Seo title="Admin" description="Manage events and registrations." />
            <Page class="admin-page">
                <Card title="Admin" heading="h1" class="admin-navigation">
                    <Show when={access.current()?.canManage}>
                        <SectionTabs
                            label="Admin sections"
                            options={tabs()}
                            value={section()}
                            onChange={selectSection}
                        />
                    </Show>
                </Card>
                <Show
                    when={access.current()?.canManage}
                    fallback={
                        <Show
                            when={!access.account.isPending() && !access.access.loading}
                            fallback={<Loading />}
                        >
                            <p>
                                {access.account.user()
                                    ? "No editing access assigned."
                                    : "Sign in to manage events."}
                            </p>
                            <Show when={!access.account.user()}>
                                <a class="button" href="/sign-in?next=%2Fadmin">
                                    Sign in
                                </a>
                            </Show>
                        </Show>
                    }
                >
                    <Suspense fallback={<Loading />}>
                        <Switch fallback={<p>You do not have access to this section.</p>}>
                            <Match when={section() === "events"}>
                                <Show
                                    when={
                                        typeof params.event === "string" ? params.event : undefined
                                    }
                                    fallback={<EventPanel />}
                                >
                                    {(eventId) => <Attendees eventId={eventId()} />}
                                </Show>
                            </Match>
                            <Match
                                when={
                                    section() === "series" &&
                                    tabs().some((tab) => tab.id === "series")
                                }
                            >
                                <Show when={!params.schedule && !params.source}>
                                    <SeriesAdmin />
                                </Show>
                                <Show
                                    when={
                                        access.current()?.isAdmin ||
                                        access
                                            .current()
                                            ?.grants.some(
                                                (grant) =>
                                                    grant.scope.kind === "series" &&
                                                    grant.role === "organiser",
                                            )
                                    }
                                >
                                    <EventPanel schedules />
                                </Show>
                            </Match>
                            <Match when={access.current()?.isAdmin && section() === "audience"}>
                                <Audience />
                            </Match>
                            <Match when={isTeam() && section() === "topics"}>
                                <TopicsAdmin />
                            </Match>
                            <Match when={access.current()?.isAdmin && section() === "people"}>
                                <AccessManager />
                            </Match>
                            <Match when={access.current()?.isAdmin && section() === "email"}>
                                <EmailAdmin />
                            </Match>
                            <Match when={isTeam() && section() === "news"}>
                                <NewsAdmin />
                            </Match>
                            {/* campaign links and aggregate arrivals */}
                            <Match when={access.current()?.isAdmin && section() === "traffic"}>
                                <Referrals />
                            </Match>
                            <Match
                                when={
                                    (isTeam() && section() === "organisations") ||
                                    (access.current()?.isAdmin &&
                                        ["jobs", "sponsors"].includes(section()))
                                }
                            >
                                <Management
                                    organisationId={
                                        typeof params.organisation === "string"
                                            ? params.organisation
                                            : undefined
                                    }
                                    section={section() as "jobs" | "sponsors" | "organisations"}
                                />
                            </Match>
                        </Switch>
                    </Suspense>
                </Show>
            </Page>
        </>
    );
}

/** Event and schedule panels share records without loading account or newsletter data. */
function EventPanel(props: { schedules?: boolean }) {
    const access = useAccess();
    const [result, { refetch }] = createResource(access.key, async (key) => ({
        key,
        value: await (
            await memberClient()
        ).query(api.events.management.workspace, {
            editor: !!props.schedules,
        }),
    }));
    const workspace = () => (result()?.key === access.key() ? result()?.value : undefined);
    return (
        <Show
            when={workspace()}
            fallback={
                <Show when={result.error} fallback={<Loading />}>
                    <p class="form-error">Could not load events.</p>
                    <button class="button" onClick={() => void refetch()}>
                        Retry
                    </button>
                </Show>
            }
        >
            {(current) => (
                <Show
                    when={props.schedules}
                    fallback={<EventAdmin workspace={current()} refresh={refetch} />}
                >
                    <Schedules workspace={current()} />
                </Show>
            )}
        </Show>
    );
}
