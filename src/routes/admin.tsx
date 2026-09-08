import { timeZone } from "../core/constants";
import { getDirectory } from "../core/queries";

import { Card } from "../component/card";
import { Arrow } from "../component/arrow";
import { createResource, createSignal, For, Show } from "solid-js";
import { useSearchParams, createAsync } from "@solidjs/router";
import { api } from "../../convex/_generated/api";
import type { Registration } from "../../convex/event";
import type { Id } from "../../convex/_generated/dataModel";
import { useAccount } from "../core/auth";

import { memberClient } from "../core/convex";
import { Page, PageHeader } from "../component/page";
import { Seo } from "../component/seo";
import { FormMessage } from "../component/form";
import { errorMessage } from "../core/error";

/** Manage owned events, community submissions, and team settings. */
export default function Route() {
    // load records under the current account
    const account = useAccount();
    const [params] = useSearchParams();
    const directory = createAsync(() => getDirectory());
    const [workspace, { refetch }] = createResource(
        () => account.user()?.id,
        async () => await (await memberClient()).query(api.workspace.events, {}),
    );

    // load newsletter controls only for team members
    const [digest, { refetch: refetchDigest }] = createResource(
        () => workspace()?.viewer.isTeam,
        async () => await (await memberClient()).query(api.newsletter.preview, {}),
    );

    // load attendees for the selected event
    const [attendees, { refetch: refetchAttendees }] = createResource(
        () => (account.user() && typeof params.event === "string" ? params.event : undefined),
        async (eventId) =>
            await (
                await memberClient()
            ).query(api.registration.attendees, { eventId: eventId as Id<"events"> }),
    );
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    const [section, setSection] = createSignal("events");

    /** Run one workspace command and refresh its visible records. */
    async function perform(work: () => Promise<unknown>, message: string) {
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await work();
            await refetch();
            await refetchAttendees();
            await refetchDigest();
            setSuccess(message);
        } catch (caught) {
            setError(errorMessage(caught, "Could not complete the action."));
        } finally {
            setIsPending(false);
        }
    }

    /** Save a team-maintained organisation. */
    async function saveOrganisation(event: SubmitEvent) {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const values = new FormData(form);
        const text = (key: string) => String(values.get(key) ?? "");
        await perform(
            async () =>
                await (
                    await memberClient()
                ).mutation(api.organisations.upsert, {
                    id: text("id") ? (text("id") as Id<"organisations">) : undefined,
                    name: text("name"),
                    slug: text("slug"),
                    description: text("description"),
                    website: text("website"),
                    location: text("location"),
                    kind: text("kind") as "company" | "lab" | "community" | "space",
                }),
            "Organisation saved. Refresh the directory to see the update.",
        );
    }

    /** Save a team-maintained event series. */
    async function saveSeries(event: SubmitEvent) {
        event.preventDefault();
        const values = new FormData(event.currentTarget as HTMLFormElement);
        const text = (key: string) => String(values.get(key) ?? "");
        await perform(
            async () =>
                await (
                    await memberClient()
                ).mutation(api.series.upsert, {
                    id: text("id") ? (text("id") as Id<"series">) : undefined,
                    name: text("name"),
                    slug: text("slug"),
                    description: text("description"),
                    topics: text("topics")
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                }),
            "Series saved.",
        );
    }

    /** Export the visible attendee records as spreadsheet-safe CSV. */
    function exportAttendees() {
        // read only the currently visible attendees
        const rows = attendees()?.rows;
        if (!rows) return;
        // escape CSV cells and prevent spreadsheet formula execution
        const cell = (value: string) =>
            `"${(/^[=+@\-]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`;
        const csv = [
            ["Name", "Email", "Status", "Answers"],
            ...rows.map((row) => [
                row.name ?? "",
                row.email ?? "",
                row.status,
                (row.answers ?? []).join(" | "),
            ]),
        ]
            .map((row) => row.map(cell).join(","))
            .join("\r\n");

        // download the export and release its temporary URL
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "attendees.csv";
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <>
            <Seo
                title="Workspace"
                description="Manage your events and the Zürich community programme."
            />
            <Page>
                <PageHeader title="Workspace" />
                <div class="row-actions">
                    <a href="/manage">Jobs & sponsors</a>
                    <a href="/settings">Account settings</a>
                </div>
                <Show
                    when={account.user()}
                    fallback={
                        <a class="button" href="/sign-in">
                            Sign in to your workspace <Arrow direction="external" />
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
                                <div class="filter-bar">
                                    <button
                                        classList={{ active: section() === "events" }}
                                        onClick={() => setSection("events")}
                                    >
                                        Events
                                    </button>
                                    <Show when={current().viewer.isTeam}>
                                        <button onClick={() => setSection("organisations")}>
                                            Organisations
                                        </button>
                                        <button onClick={() => setSection("series")}>Series</button>
                                        <button onClick={() => setSection("people")}>
                                            Organisers
                                        </button>
                                        <button onClick={() => setSection("email")}>
                                            Weekly email
                                        </button>
                                    </Show>
                                    <a class="button button--primary" href="/submit">
                                        + New event
                                    </a>
                                </div>
                                <FormMessage error={error()} success={success()} />
                                <Show when={section() === "events"}>
                                    <p class="page-lead">
                                        {current().viewer.isTeam
                                            ? "Review community submissions and manage the programme."
                                            : current().viewer.canPublish
                                              ? "You can publish your own events directly."
                                              : "Create a draft and submit it to the team for review."}
                                    </p>
                                    <div class="workspace-list">
                                        <For each={current().published}>
                                            {(item) => (
                                                <Card title={item.title} meta={item.status}>
                                                    <div class="row-actions">
                                                        <button
                                                            disabled={isPending()}
                                                            onClick={() =>
                                                                perform(async () => {
                                                                    const id = await (
                                                                        await memberClient()
                                                                    ).mutation(api.events.edit, {
                                                                        eventId: item._id,
                                                                    });
                                                                    window.location.assign(
                                                                        `/submit?edit=${id}`,
                                                                    );
                                                                }, "Opened event editor.")
                                                            }
                                                        >
                                                            Edit
                                                        </button>
                                                        <a href={`/events/${item.slug}`}>View</a>
                                                        <a href={`/admin?event=${item._id}`}>
                                                            Attendees
                                                        </a>
                                                    </div>
                                                </Card>
                                            )}
                                        </For>
                                        <For each={current().submissions}>
                                            {(item) => (
                                                <Card
                                                    title={item.title}
                                                    meta={`${item.status} · ${new Date(item.startsAt).toLocaleDateString("en-GB", { timeZone })}`}
                                                >
                                                    <Show when={item.reviewNote}>
                                                        <p>{item.reviewNote}</p>
                                                    </Show>
                                                    <div class="row-actions">
                                                        <a href={`/submit?edit=${item._id}`}>
                                                            Edit
                                                        </a>
                                                        <a href={`/submit?duplicate=${item._id}`}>
                                                            Duplicate
                                                        </a>
                                                        <Show when={item.eventId}>
                                                            <a href={`/events/${item.slug}`}>
                                                                View <Arrow direction="external" />
                                                            </a>
                                                            <a
                                                                href={`/admin?event=${item.eventId}`}
                                                            >
                                                                Attendees
                                                            </a>
                                                        </Show>
                                                        <Show
                                                            when={
                                                                item.status !== "published" &&
                                                                current().viewer.canPublish
                                                            }
                                                        >
                                                            <button
                                                                disabled={isPending()}
                                                                onClick={() =>
                                                                    perform(
                                                                        async () =>
                                                                            await (
                                                                                await memberClient()
                                                                            ).mutation(
                                                                                api.events.publish,
                                                                                { id: item._id },
                                                                            ),
                                                                        "Event published.",
                                                                    )
                                                                }
                                                            >
                                                                Publish
                                                            </button>
                                                        </Show>
                                                        <Show
                                                            when={
                                                                current().viewer.isTeam &&
                                                                item.status === "review"
                                                            }
                                                        >
                                                            <button
                                                                disabled={isPending()}
                                                                onClick={() => {
                                                                    const note = window.prompt(
                                                                        "What needs to change before publication?",
                                                                    );
                                                                    if (note)
                                                                        void perform(
                                                                            async () =>
                                                                                await (
                                                                                    await memberClient()
                                                                                ).mutation(
                                                                                    api.events
                                                                                        .decline,
                                                                                    {
                                                                                        id: item._id,
                                                                                        note,
                                                                                    },
                                                                                ),
                                                                            "Feedback sent to the workspace.",
                                                                        );
                                                                }}
                                                            >
                                                                Return for changes
                                                            </button>
                                                        </Show>
                                                    </div>
                                                </Card>
                                            )}
                                        </For>
                                    </div>
                                    <Show when={current().submissions.length === 0}>
                                        <div class="empty-panel">
                                            <h2>No events yet.</h2>
                                            <p>
                                                Create an event and save a draft whenever you like.
                                            </p>
                                            <a class="text-link" href="/submit">
                                                Create your first event{" "}
                                                <Arrow direction="external" />
                                            </a>
                                        </div>
                                    </Show>
                                    <Show when={attendees.error}>
                                        <p class="form-error">
                                            {errorMessage(
                                                attendees.error,
                                                "Could not load attendees.",
                                            )}
                                        </p>
                                    </Show>
                                    <Show when={attendees()}>
                                        {(list) => (
                                            <section class="attendee-section">
                                                <div class="section-intro--row">
                                                    <h2>{list().event.title} · Attendees</h2>
                                                    <button
                                                        class="button"
                                                        onClick={exportAttendees}
                                                    >
                                                        Export CSV
                                                    </button>
                                                </div>
                                                <div class="table-scroll">
                                                    <table>
                                                        <thead>
                                                            <tr>
                                                                <th>Name / email</th>
                                                                <th>Status</th>
                                                                <th>Answers</th>
                                                                <th>Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <For each={list().rows}>
                                                                {(row) => (
                                                                    <tr>
                                                                        <td>
                                                                            {row.name}
                                                                            <br />
                                                                            <small>
                                                                                {row.email}
                                                                            </small>
                                                                        </td>
                                                                        <td>{row.status}</td>
                                                                        <td>
                                                                            <For each={row.answers}>
                                                                                {(
                                                                                    answer,
                                                                                    index,
                                                                                ) => (
                                                                                    <p>
                                                                                        <strong>
                                                                                            {questionLabel(
                                                                                                list()
                                                                                                    .event
                                                                                                    .registration,
                                                                                                index(),
                                                                                            )}
                                                                                        </strong>
                                                                                        <br />
                                                                                        {answer}
                                                                                    </p>
                                                                                )}
                                                                            </For>
                                                                        </td>
                                                                        <td>
                                                                            <Show
                                                                                when={
                                                                                    row.status ===
                                                                                    "pending"
                                                                                }
                                                                            >
                                                                                <button
                                                                                    disabled={isPending()}
                                                                                    onClick={() =>
                                                                                        perform(
                                                                                            async () =>
                                                                                                await (
                                                                                                    await memberClient()
                                                                                                ).mutation(
                                                                                                    api
                                                                                                        .registration
                                                                                                        .decide,
                                                                                                    {
                                                                                                        id: row._id,
                                                                                                        decision:
                                                                                                            "approve",
                                                                                                    },
                                                                                                ),
                                                                                            "Application approved.",
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    Approve
                                                                                </button>
                                                                                <button
                                                                                    disabled={isPending()}
                                                                                    onClick={() =>
                                                                                        perform(
                                                                                            async () =>
                                                                                                await (
                                                                                                    await memberClient()
                                                                                                ).mutation(
                                                                                                    api
                                                                                                        .registration
                                                                                                        .decide,
                                                                                                    {
                                                                                                        id: row._id,
                                                                                                        decision:
                                                                                                            "decline",
                                                                                                    },
                                                                                                ),
                                                                                            "Application declined.",
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    Decline
                                                                                </button>
                                                                            </Show>
                                                                            <Show
                                                                                when={
                                                                                    row.status !==
                                                                                        "cancelled" &&
                                                                                    row.status !==
                                                                                        "declined"
                                                                                }
                                                                            >
                                                                                <button
                                                                                    disabled={isPending()}
                                                                                    onClick={() =>
                                                                                        perform(
                                                                                            async () =>
                                                                                                await (
                                                                                                    await memberClient()
                                                                                                ).mutation(
                                                                                                    api
                                                                                                        .registration
                                                                                                        .decide,
                                                                                                    {
                                                                                                        id: row._id,
                                                                                                        decision:
                                                                                                            "cancel",
                                                                                                    },
                                                                                                ),
                                                                                            "Registration cancelled.",
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                            </Show>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </For>
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <Show when={list().rows.length === 0}>
                                                    <p>No registrations yet.</p>
                                                </Show>
                                                <button
                                                    class="button"
                                                    disabled={
                                                        isPending() ||
                                                        list().event.status === "cancelled"
                                                    }
                                                    onClick={() => {
                                                        if (
                                                            window.confirm(
                                                                "Cancel this event and notify its attendees?",
                                                            )
                                                        )
                                                            void perform(
                                                                async () =>
                                                                    await (
                                                                        await memberClient()
                                                                    ).mutation(api.events.cancel, {
                                                                        eventId: list().event._id,
                                                                    }),
                                                                "Event cancelled.",
                                                            );
                                                    }}
                                                >
                                                    Cancel event & notify attendees
                                                </button>
                                            </section>
                                        )}
                                    </Show>
                                </Show>
                                <Show
                                    when={section() === "organisations" && current().viewer.isTeam}
                                >
                                    <div class="admin-catalogue">
                                        <For each={directory()?.organisations}>
                                            {(item) => (
                                                <details>
                                                    <summary>{item.name}</summary>
                                                    <OrganisationForm
                                                        item={item}
                                                        onSubmit={saveOrganisation}
                                                        isPending={isPending()}
                                                    />
                                                </details>
                                            )}
                                        </For>
                                        <h2>Add an organisation</h2>
                                        <OrganisationForm
                                            onSubmit={saveOrganisation}
                                            isPending={isPending()}
                                        />
                                    </div>
                                </Show>
                                <Show when={section() === "series" && current().viewer.isTeam}>
                                    <div class="admin-catalogue">
                                        <For each={directory()?.series}>
                                            {(item) => (
                                                <details>
                                                    <summary>{item.name}</summary>
                                                    <SeriesForm
                                                        item={item}
                                                        onSubmit={saveSeries}
                                                        isPending={isPending()}
                                                    />
                                                </details>
                                            )}
                                        </For>
                                        <h2>Add a series</h2>
                                        <SeriesForm onSubmit={saveSeries} isPending={isPending()} />
                                    </div>
                                </Show>
                                <Show when={section() === "people" && current().viewer.isTeam}>
                                    <h2>Trusted organisers</h2>
                                    <p>
                                        Publishing permission applies only to an organiser’s own
                                        events.
                                    </p>
                                    <div class="workspace-list">
                                        <For each={current().people}>
                                            {(person) => (
                                                <article>
                                                    <h3>{person.name}</h3>
                                                    <label class="checkbox">
                                                        <input
                                                            type="checkbox"
                                                            checked={person.canPublish}
                                                            disabled={isPending()}
                                                            onChange={(event) => {
                                                                const canPublish =
                                                                    event.currentTarget.checked;
                                                                void perform(
                                                                    async () =>
                                                                        await (
                                                                            await memberClient()
                                                                        ).mutation(
                                                                            api.access
                                                                                .setPublishingAccess,
                                                                            {
                                                                                id: person.id,
                                                                                canPublish,
                                                                            },
                                                                        ),
                                                                    "Publishing permission updated.",
                                                                );
                                                            }}
                                                        />
                                                        Can publish directly
                                                    </label>
                                                </article>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                                <Show when={section() === "email" && current().viewer.isTeam}>
                                    <h2>The weekly programme</h2>
                                    <p>
                                        Monday at 09:00 Zürich time. All upcoming published events.
                                        Empty editions are skipped.
                                    </p>
                                    <label class="checkbox">
                                        <input
                                            type="checkbox"
                                            checked={current().digest?.isPaused ?? false}
                                            disabled={isPending()}
                                            onChange={(event) => {
                                                const isPaused = event.currentTarget.checked;
                                                void perform(
                                                    async () =>
                                                        await (
                                                            await memberClient()
                                                        ).mutation(api.newsletter.pause, {
                                                            isPaused,
                                                        }),
                                                    "Newsletter schedule updated.",
                                                );
                                            }}
                                        />
                                        Pause automatic sending
                                    </label>
                                    <Show when={digest.error}>
                                        <p class="form-error">
                                            {errorMessage(
                                                digest.error,
                                                "Could not load the email preview.",
                                            )}
                                        </p>
                                    </Show>
                                    <Show when={digest()}>
                                        {(edition) => (
                                            <>
                                                <p>{edition().subscribers} confirmed subscribers</p>
                                                <iframe
                                                    class="email-preview"
                                                    title="Newsletter preview"
                                                    srcdoc={edition().html}
                                                    sandbox=""
                                                />
                                                <For each={edition().failures}>
                                                    {(failure) => (
                                                        <p class="form-error">
                                                            {failure.subject} → {failure.to}:{" "}
                                                            {failure.error}
                                                        </p>
                                                    )}
                                                </For>
                                            </>
                                        )}
                                    </Show>
                                </Show>
                            </>
                        )}
                    </Show>
                </Show>
            </Page>
        </>
    );
}

/** Edit a curated organisation. */
function OrganisationForm(props: {
    item?: {
        _id: string;
        name: string;
        slug: string;
        description: string;
        website: string;
        location: string;
        kind: string;
    };
    onSubmit: (event: SubmitEvent) => Promise<void>;
    isPending: boolean;
}) {
    return (
        <form class="editor" onSubmit={props.onSubmit}>
            <input type="hidden" name="id" value={props.item?._id ?? ""} />
            <div class="form-columns">
                <label>
                    Name
                    <input required name="name" value={props.item?.name ?? ""} />
                </label>
                <label>
                    Slug
                    <input required name="slug" value={props.item?.slug ?? ""} />
                </label>
            </div>
            <label>
                Description
                <textarea required name="description" value={props.item?.description ?? ""} />
            </label>
            <div class="form-columns">
                <label>
                    Website
                    <input required type="url" name="website" value={props.item?.website ?? ""} />
                </label>
                <label>
                    Location
                    <input required name="location" value={props.item?.location ?? "Zürich"} />
                </label>
            </div>
            <label>
                Type
                <select name="kind" value={props.item?.kind ?? "company"}>
                    <For each={["company", "lab", "community", "space"]}>
                        {(kind) => <option value={kind}>{kind}</option>}
                    </For>
                </select>
            </label>
            <button class="button" disabled={props.isPending}>
                Save organisation
            </button>
        </form>
    );
}

/** Edit a recurring series and its default topics. */
function SeriesForm(props: {
    item?: { _id: string; name: string; slug: string; description: string; topics: string[] };
    onSubmit: (event: SubmitEvent) => Promise<void>;
    isPending: boolean;
}) {
    return (
        <form class="editor" onSubmit={props.onSubmit}>
            <input type="hidden" name="id" value={props.item?._id ?? ""} />
            <div class="form-columns">
                <label>
                    Name
                    <input required name="name" value={props.item?.name ?? ""} />
                </label>
                <label>
                    Slug
                    <input required name="slug" value={props.item?.slug ?? ""} />
                </label>
            </div>
            <label>
                Description
                <textarea required name="description" value={props.item?.description ?? ""} />
            </label>
            <label>
                Topics
                <input name="topics" value={props.item?.topics.join(", ") ?? ""} />
            </label>
            <button class="button" disabled={props.isPending}>
                Save series
            </button>
        </form>
    );
}

/** Read one native attendee question label. */
function questionLabel(policy: Registration, index: number) {
    return policy.kind === "native" ? policy.questions[index]?.label : "Answer";
}
