import { confirmEvent } from "../../events/actions";
import {
    EventFields,
    VenueFields,
    ProgrammeFields,
    RegistrationFields,
} from "../../events/event-editor";
import { getDirectory } from "../../organisations/queries";
import { Arrow } from "../../components/arrow";
import { Card } from "../../components/card";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { useNavigate, revalidate, createAsync, useSearchParams } from "@solidjs/router";
import type { Registration } from "../../../convex/events/fields";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { useAccount } from "../../auth/index";
import { memberClient } from "../../auth/convex";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";
import { FormMessage } from "../../components/form";
import { errorMessage } from "../../components/errors";
import { timestamp } from "../../events/time";

/** Create, duplicate, and revise an event in the organiser workspace. */
export default function Route() {
    const navigate = useNavigate();
    const account = useAccount();
    const [params, setParams] = useSearchParams();
    const directory = createAsync(() => getDirectory());
    const [access] = createResource(
        () => account.user()?.id,
        async () => (await memberClient()).query(api.auth.queries.current, {}),
    );
    const [workspace, { refetch: refreshWorkspace }] = createResource(
        () => access()?.isTeam,
        async () => await (await memberClient()).query(api.events.workspace.events, {}),
    );
    const draft = () => {
        const item = workspace()?.submissions.find(
            (item) => item._id === (params.edit ?? params.duplicate),
        );
        if (!item || !params.duplicate) return item;

        return {
            ...item,
            startsAt: 0,
            endsAt: undefined,
            registration:
                item.registration.kind === "native"
                    ? { ...item.registration, closesAt: undefined }
                    : item.registration,
        };
    };

    /** Open a source revision without creating a duplicate until the form is saved. */
    async function duplicate(value: string) {
        setError(undefined);
        setIsPending(true);
        try {
            const published = workspace()?.published.find((event) => event._id === value);
            const id = published
                ? await (
                      await memberClient()
                  ).mutation(api.events.mutations.edit, { eventId: published._id })
                : value;
            if (published) await refreshWorkspace();
            setParams({ duplicate: id || undefined });
        } catch (caught) {
            setError(errorMessage(caught, "Could not open the event."));
        } finally {
            setIsPending(false);
        }
    }
    const [kind, setKind] = createSignal("native");
    const [questions, setQuestions] = createSignal<{ label: string; isRequired: boolean }[]>([]);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    let form!: HTMLFormElement;
    createEffect(() => {
        const item = draft();
        setKind(item?.registration.kind ?? "native");
        setQuestions(item?.registration.kind === "native" ? item.registration.questions : []);
    });

    const eventStatus = () =>
        params.edit && draft()?.eventId
            ? workspace()?.statuses.find((event) => event.id === draft()?.eventId)?.status
            : undefined;
    const isPublished = () => eventStatus() === "scheduled" || eventStatus() === "finished";
    const isCancelled = () => eventStatus() === "cancelled";

    /** Confirm hiding or cancelling an existing event without saving form edits. */
    async function transition(action: "unpublish" | "cancel") {
        const eventId = draft()?.eventId;
        if (!eventId) return;
        setIsPending(true);
        setError(undefined);
        try {
            const receipt = await confirmEvent(
                { eventId, action },
                action === "unpublish" ? "Unpublish event" : "Cancel event",
            );
            if (receipt === undefined) return;
            const client = await memberClient();
            await client.mutation(
                action === "unpublish"
                    ? api.events.mutations.unpublish
                    : api.events.mutations.cancel,
                { eventId, receipt },
            );
            await revalidate();
            navigate("/admin");
        } catch (caught) {
            setError(errorMessage(caught, "Could not update the event."));
        } finally {
            setIsPending(false);
        }
    }

    /** Save one validated draft and optionally publish it. */
    async function save(event: SubmitEvent) {
        // read the authored event fields
        event.preventDefault();
        setError(undefined);
        setSuccess(undefined);
        setIsPending(true);
        const fields = new FormData(form);
        const intent = (event.submitter as HTMLButtonElement)?.value;
        const text = (name: string) => String(fields.get(name) ?? "").trim();
        try {
            const policy: Registration =
                kind() === "external"
                    ? {
                          kind: "external",
                          url: text("url"),
                          capacity: text("capacity") ? Number(text("capacity")) : undefined,
                      }
                    : kind() === "none"
                      ? { kind: "none" }
                      : {
                            kind: "native",
                            admission: text("admission") as "automatic" | "approval",
                            capacity: text("capacity") ? Number(text("capacity")) : null,
                            overflow: text("overflow") as "waitlist" | "closed",
                            closesAt: text("closesAt") ? timestamp(text("closesAt")) : undefined,
                            questions: questions(),
                        };
            const client = await memberClient();
            const values = {
                title: text("title"),
                slug: text("slug"),
                description: text("description"),
                summary: text("summary"),
                format: text("format") as Doc<"events">["format"],
                seriesId: text("series") ? (text("series") as Id<"series">) : undefined,
                topics: text("topics")
                    .split(",")
                    .map((tag) => tag.trim().toLowerCase())
                    .filter(Boolean),
                startsAt: timestamp(text("startsAt")),
                endsAt: text("endsAt") ? timestamp(text("endsAt")) : undefined,
                location: text("location"),
                address: text("address"),
                latitude: text("latitude") ? Number(text("latitude")) : undefined,
                longitude: text("longitude") ? Number(text("longitude")) : undefined,
                registration: policy,
                organiserIds: fields.getAll("organiserIds") as Id<"members">[],
                organisations: fields.getAll("organisations") as Id<"organisations">[],
                speakers: fields.getAll("speakerName").map((name, index) => ({
                    name: String(name).trim(),
                    title: String(fields.getAll("speakerTitle")[index] ?? "").trim(),
                    links: String(fields.getAll("speakerLinks")[index] ?? "")
                        .split("\n")
                        .map((link) => link.trim())
                        .filter(Boolean),
                    imageUrl:
                        String(fields.getAll("speakerImage")[index] ?? "").trim() || undefined,
                    imageDarkUrl:
                        String(fields.getAll("speakerImageDark")[index] ?? "").trim() || undefined,
                })),
                agenda: fields.getAll("agendaTitle").map((title, index) => ({
                    title: String(title).trim(),
                    time: String(fields.getAll("agendaTime")[index] ?? "").trim(),
                })),
            };
            const sourceId = params.edit ? draft()?._id : undefined;
            const receipt =
                intent === "publish"
                    ? await confirmEvent(
                          { id: sourceId, action: "publish", fields: values },
                          isPublished() ? "Save changes" : "Publish event",
                      )
                    : undefined;
            if (intent === "publish" && receipt === undefined) return;
            await client.mutation(api.events.mutations.save, {
                ...values,
                id: sourceId,
                publish: intent === "publish",
                receipt,
            });
            setSuccess(
                intent === "publish" ? "Published. Your event is on the calendar." : "Draft saved.",
            );
            await revalidate();
            navigate(`/admin?saved=${intent}`);
        } catch (caught) {
            setError(errorMessage(caught, "Could not save the event."));
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
                            : "Edit event"
                        : params.duplicate
                          ? draft()?.title
                              ? `Duplicate ${draft()!.title}`
                              : "Duplicate event"
                          : "New event"
                }
                description="Create and edit zurich.tech events."
            />
            <Page>
                <PageHeader
                    title={params.edit ? "Edit event" : "New event"}
                    actions={
                        <Show when={workspace() && (!(params.edit || params.duplicate) || draft())}>
                            <span
                                class="event-publication"
                                classList={{ "event-publication--published": isPublished() }}
                            >
                                {isCancelled()
                                    ? "Cancelled"
                                    : isPublished()
                                      ? "Published"
                                      : "Draft"}
                            </span>
                        </Show>
                    }
                />
                <Show
                    when={access()?.isTeam}
                    fallback={
                        <div class="empty-panel">
                            <h2>Team access required</h2>
                            <p>Event creation and editing are available to the zurich.tech team.</p>
                            <a class="button button--primary" href="/contribute#events">
                                Suggest an event <Arrow />
                            </a>
                            <Show when={!account.user() && !account.isPending()}>
                                <a class="button" href="/sign-in?next=%2Fsubmit">
                                    Sign in
                                </a>
                            </Show>
                            <Show when={access.error}>
                                <p class="form-error" role="alert">
                                    {errorMessage(access.error, "Could not load your account.")}
                                </p>
                            </Show>
                        </div>
                    }
                >
                    <Show when={workspace.error}>
                        <p role="alert" class="form-error">
                            {errorMessage(workspace.error, "Could not load your workspace.")}
                        </p>
                    </Show>
                    <Show when={workspace() && (!(params.edit || params.duplicate) || draft())}>
                        <form class="editor event-editor" ref={form} onSubmit={save}>
                            <Show when={!params.edit}>
                                <Card title="Duplicate from">
                                    <select
                                        aria-label="Duplicate from"
                                        disabled={isPending()}
                                        value={params.duplicate ?? ""}
                                        onChange={(event) =>
                                            void duplicate(event.currentTarget.value)
                                        }
                                    >
                                        <option value="">Blank event</option>
                                        <For
                                            each={[
                                                ...(workspace()?.submissions ?? []),
                                                ...(workspace()?.published ?? []),
                                            ].sort((a, b) => b.startsAt - a.startsAt)}
                                        >
                                            {(event) => (
                                                <option value={event._id}>{event.title}</option>
                                            )}
                                        </For>
                                    </select>
                                </Card>
                            </Show>
                            <div class="event-editor__columns">
                                <div class="event-editor__column">
                                    {/* describe the event and its relationship to a series */}
                                    <EventFields
                                        draft={draft()}
                                        isDuplicate={!!params.duplicate}
                                        directory={directory()}
                                    />
                                    {/* keep programme details optional and quick to enter */}
                                    <ProgrammeFields draft={draft()} directory={directory()} />
                                </div>
                                <div class="event-editor__column">
                                    <Card title="Organisers">
                                        <div class="organiser-options">
                                            <For each={workspace()?.organisers}>
                                                {(person) => (
                                                    <label class="checkbox-label">
                                                        <input
                                                            type="checkbox"
                                                            name="organiserIds"
                                                            value={person.id}
                                                            checked={(
                                                                draft()?.organiserIds ??
                                                                (draft()
                                                                    ? []
                                                                    : [workspace()!.viewerId])
                                                            ).includes(person.id)}
                                                        />
                                                        {person.name}
                                                    </label>
                                                )}
                                            </For>
                                        </div>
                                    </Card>
                                    {/* enter real Zürich local dates and an optional map position */}
                                    <VenueFields draft={draft()} />
                                    {/* compose admission, capacity, and overflow independently */}
                                    <RegistrationFields
                                        draft={draft()}
                                        kind={kind()}
                                        setKind={setKind}
                                        questions={questions()}
                                        setQuestions={setQuestions}
                                    />
                                </div>
                            </div>
                            <div class="form-actions">
                                <Show when={!isCancelled()} fallback={<p>Cancelled</p>}>
                                    <Show when={!isPublished()}>
                                        <button
                                            class="button"
                                            type="submit"
                                            value="draft"
                                            disabled={isPending()}
                                        >
                                            Save draft
                                        </button>
                                    </Show>
                                    <button
                                        class="button button--primary"
                                        type="submit"
                                        value="publish"
                                        disabled={isPending()}
                                    >
                                        {isPending()
                                            ? "Saving…"
                                            : isPublished()
                                              ? "Save changes"
                                              : "Publish event"}
                                    </button>
                                    <Show when={isPublished()}>
                                        <button
                                            class="button"
                                            type="button"
                                            disabled={isPending()}
                                            onClick={() => void transition("unpublish")}
                                        >
                                            Unpublish
                                        </button>
                                        <button
                                            class="button"
                                            type="button"
                                            disabled={isPending()}
                                            onClick={() => void transition("cancel")}
                                        >
                                            Cancel event
                                        </button>
                                    </Show>
                                </Show>
                            </div>
                            <FormMessage error={error()} success={success()} />
                        </form>
                    </Show>
                </Show>
            </Page>
        </>
    );
}
