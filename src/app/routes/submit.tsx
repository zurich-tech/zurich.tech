import { readAffiliations } from "../../members/affiliations";
import { OrganiserCard } from "../../events/organiser";
import { registrationSite } from "../../events/registration";
import { DeleteRecord } from "../../events/delete";
import { EventOptions } from "../../events/participation";
import { useConfirmation } from "../../components/dialog";
import { EventMail } from "../../events/mail";
import { readConfirmation } from "../../events/confirmation";
import { isTentative } from "../../../convex/events/conditions";
import { confirmEvent } from "../../events/actions";
import { EventFields, VenueFields, ProgrammeFields } from "../../events/event-editor";
import { getDirectory } from "../../organisations/queries";
import { Arrow } from "../../components/arrow";
import { Card } from "../../components/card";
import { startTransition, createEffect, createResource, createSignal, For, Show } from "solid-js";
import { useNavigate, revalidate, useSearchParams } from "@solidjs/router";
import type { Registration } from "../../../convex/events/fields";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { useAccess } from "../../auth/edit";
import { memberClient } from "../../auth/convex";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";
import { savedEditor, Editor, FormMessage } from "../../components/form";
import { errorMessage } from "../../components/errors";
import { timestamp } from "../../events/time";

/** Create, duplicate, and revise an event in the organiser workspace. */
export default function Route() {
    const confirm = useConfirmation();
    const navigate = useNavigate();
    const authority = useAccess();
    const { account } = authority;
    const [params, setParams] = useSearchParams();
    const directory = getDirectory.use(() => []);
    const access = authority.access;
    const [workspaceResult, { refetch: refreshWorkspace }] = createResource(
        authority.key,
        async (key) => ({
            key,
            value: await (
                await memberClient()
            ).query(api.events.management.workspace, { editor: true }),
        }),
    );
    const workspace = () =>
        workspaceResult()?.key === authority.key() ? workspaceResult()?.value : undefined;
    createEffect(() => {
        const eventId = typeof params.event === "string" ? params.event : undefined;
        if (!eventId || !authority.canEvent(eventId)) return;
        void memberClient()
            .then((client) =>
                client.mutation(api.events.mutations.edit, { eventId: eventId as Id<"events"> }),
            )
            .then(async (id) => {
                await startTransition(refreshWorkspace);
                setParams({ event: undefined, edit: id }, { replace: true });
            })
            .catch((caught) => setError(errorMessage(caught, "Could not open the event.")));
    });
    const draft = () => {
        const item = workspace()?.submissions.find(
            (item) => item._id === (params.edit ?? params.duplicate),
        );
        if (!item || !params.duplicate) return item;

        return {
            ...item,
            confirmation: item.confirmation
                ? { ...item.confirmation, decidesAt: item.confirmation.decidesAt - item.startsAt }
                : undefined,
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
            if (published) await startTransition(refreshWorkspace);
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
    const [visibility, setVisibility] = createSignal<"public" | "unlisted">("public");
    createEffect(() => setVisibility(draft()?.visibility ?? "public"));
    const currentEvent = () => workspace()?.statuses.find((event) => event.id === draft()?.eventId);
    const isPublished = () => eventStatus() === "scheduled" || eventStatus() === "finished";
    const isCancelled = () => eventStatus() === "cancelled";
    const canPublish = () =>
        params.edit && draft()?.eventId
            ? authority.canEvent(draft()!.eventId, "organiser")
            : !!authority.current()?.isAdmin ||
              !!authority
                  .current()
                  ?.grants.some(
                      (grant) => grant.scope.kind === "series" && grant.role === "organiser",
                  );
    const initialSeries = () =>
        typeof params.series === "string"
            ? params.series
            : authority
                  .current()
                  ?.grants.find(
                      (grant) => grant.scope.kind === "series" && grant.role === "organiser",
                  )?.scope.id;
    const saveActions = () => (
        <>
            <button
                type="submit"
                form="event-editor"
                value={isPublished() && canPublish() ? "publish" : "draft"}
                class="button"
                classList={{ "button--primary": !canPublish() || isPublished() }}
                disabled={isPending()}
            >
                {isPending() ? "Saving…" : "Save"}
            </button>
            <Show when={canPublish() && !isPublished()}>
                <button
                    type="submit"
                    form="event-editor"
                    value="publish"
                    class="button button--primary"
                    disabled={isPending()}
                >
                    Publish event
                </button>
            </Show>
        </>
    );

    /** Confirm hiding or cancelling an existing event without saving form edits. */
    async function transition(action: "unpublish" | "cancel" | "approve" | "confirm") {
        const eventId = draft()?.eventId;
        if (!eventId) return;
        setIsPending(true);
        setError(undefined);
        try {
            const receipt = await confirmEvent(
                { eventId, action },
                {
                    unpublish: "Unpublish event",
                    cancel: "Cancel event",
                    approve: "Approve event",
                    confirm: "Confirm event despite unmet requirements",
                }[action],
                confirm,
            );
            if (receipt === undefined) return;
            const client = await memberClient();
            if (action === "approve" || action === "confirm") {
                await client.mutation(api.events.confirmation.decide, { eventId, action, receipt });
                await startTransition(refreshWorkspace);
                setSuccess(action === "approve" ? "Team approval recorded." : "Event confirmed.");
                await revalidate();
                return;
            }
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
            if (intent === "publish" && (!text("description") || !text("location")))
                throw new Error("Add a description and venue before publishing.");
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
            const organisations = [...fields.entries()].filter(
                ([name, role]) => name.startsWith("organisation:") && role !== "none",
            );
            const client = await memberClient();
            const values = {
                visibility: (text("visibility") || "public") as "public" | "unlisted",
                title: text("title"),
                slug: text("slug"),
                description: text("description"),
                summary: text("summary"),
                format: text("format") as Doc<"events">["format"],
                seriesId: text("series") ? (text("series") as Id<"series">) : undefined,
                topics: fields.getAll("topic").map(String),
                startsAt: timestamp(text("startsAt"), draft()?.startsAt),
                confirmation: readConfirmation(
                    fields,
                    timestamp(text("startsAt"), draft()?.startsAt),
                ),
                endsAt: text("endsAt") ? timestamp(text("endsAt"), draft()?.endsAt) : undefined,
                location: text("location"),
                addressAccess:
                    text("addressKind") === "external"
                        ? {
                              kind: "external" as const,
                              url: text("addressUrl")!,
                              label: text("addressLabel") || registrationSite(text("addressUrl")),
                          }
                        : {
                              kind: (text("addressKind") || "public") as
                                  "public" | "confirmed" | "unannounced",
                          },
                address: text("address"),
                latitude: text("latitude") ? Number(text("latitude")) : undefined,
                longitude: text("longitude") ? Number(text("longitude")) : undefined,
                registration: policy,
                coOrganiserIds:
                    text("coOrganiserMode") === "inherit"
                        ? undefined
                        : (fields.getAll("coOrganiserId").map(String) as Id<"members">[]),
                primaryOrganiserId: text("primaryOrganiserId")
                    ? (text("primaryOrganiserId") as Id<"members">)
                    : undefined,
                organisations: organisations.map(
                    ([name]) => name.slice("organisation:".length) as Id<"organisations">,
                ),
                partnerIds: organisations
                    .filter(([, role]) => role === "partner")
                    .map(([name]) => name.slice("organisation:".length) as Id<"organisations">),
                venueCapacity: text("venueCapacity") ? Number(text("venueCapacity")) : undefined,
                checkIn: { isEnabled: fields.has("checkIn") },
                feedback: {
                    isEventEnabled: fields.has("eventFeedback"),
                    isSpeakerEnabled: fields.has("speakerFeedback"),
                },
                followUp: {
                    isEnabled: fields.has("followUp"),
                    delayHours: Number(text("followUpDelay") || 24),
                },
                speakers: fields.getAll("speakerName").map((name, index) => ({
                    id: params.duplicate
                        ? undefined
                        : ((String(fields.getAll("speakerId")[index] || "") || undefined) as
                              Id<"speakers"> | undefined),
                    memberId: (String(fields.getAll("speakerMember")[index] || "") || undefined) as
                        Id<"members"> | undefined,
                    name: String(name).trim(),
                    affiliations: readAffiliations(fields.getAll("speakerAffiliations")[index]),
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
            const announce = intent === "publish" && fields.get("announce") === "on";
            const sourceId = params.edit ? draft()?._id : undefined;
            const receipt =
                intent === "publish"
                    ? await confirmEvent(
                          { id: sourceId, action: "publish", fields: values, announce },
                          isPublished() ? "Save" : "Publish event",
                          confirm,
                      )
                    : undefined;
            if (intent === "publish" && receipt === undefined) return;
            await client.mutation(api.events.mutations.save, {
                ...values,
                id: sourceId,
                publish: intent === "publish",
                announce,
                receipt,
            });
            savedEditor(form);
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
                        <>
                            <Show
                                when={
                                    authority.current()?.canManage &&
                                    workspace() &&
                                    !isCancelled() &&
                                    (!(params.edit || params.duplicate) || draft())
                                }
                            >
                                {saveActions()}
                            </Show>
                            <Show
                                when={
                                    authority.current()?.isAdmin && params.edit
                                        ? draft()
                                        : undefined
                                }
                            >
                                {(item) => (
                                    <DeleteRecord
                                        id={item()._id}
                                        name="event"
                                        onDeleted={async () => {
                                            await revalidate();
                                            navigate("/admin");
                                        }}
                                    />
                                )}
                            </Show>
                            <a class="action-link" href="/admin">
                                Back
                            </a>
                            <Show when={params.edit && draft()?.eventId && isPublished()}>
                                <a class="action-link" href={`/events/${draft()!.slug}`}>
                                    View event
                                </a>
                            </Show>
                            <Show
                                when={
                                    workspace() && (!(params.edit || params.duplicate) || draft())
                                }
                            >
                                <span
                                    class="tag status-control"
                                    classList={{ "tag-upcoming": isPublished() }}
                                >
                                    {isCancelled()
                                        ? "Cancelled"
                                        : isPublished()
                                          ? "Published"
                                          : "Draft"}
                                </span>
                            </Show>
                        </>
                    }
                />
                <Show
                    when={authority.current()?.canManage}
                    fallback={
                        <div class="empty-panel">
                            <h2>Editing access required</h2>
                            <p>Ask an admin for event or series access.</p>
                            <a class="button button--primary" href="/contribute#events">
                                Suggest event <Arrow />
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
                    <Show when={workspaceResult.error}>
                        <p role="alert" class="form-error">
                            {errorMessage(workspaceResult.error, "Could not load your workspace.")}
                        </p>
                    </Show>
                    <Show when={workspace() && (!(params.edit || params.duplicate) || draft())}>
                        <Editor
                            id="event-editor"
                            class="editor event-editor"
                            ref={form}
                            onSubmit={save}
                            actions={() => (
                                <Card title="Publication" class="editor-publication">
                                    <Show
                                        when={!isCancelled() && canPublish()}
                                        fallback={<p>Save a draft for an organiser to publish.</p>}
                                    >
                                        <Show
                                            when={!isPublished()}
                                            fallback={
                                                <p>Changes appear on the event page when saved.</p>
                                            }
                                        >
                                            <Show when={visibility() === "public"}>
                                                <label class="checkbox">
                                                    <input
                                                        type="checkbox"
                                                        name="announce"
                                                        disabled={isPending()}
                                                    />
                                                    Announce to subscribers
                                                </label>
                                            </Show>
                                            <p>
                                                Save keeps a draft. Publish opens a review with the
                                                email count.
                                            </p>
                                        </Show>
                                    </Show>
                                    <div class="form-actions">
                                        <Show when={!isCancelled()} fallback={<p>Cancelled</p>}>
                                            {saveActions()}
                                            <Show when={isPublished() && canPublish()}>
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
                                </Card>
                            )}
                        >
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
                            <div class="editor-columns">
                                <div class="editor-column">
                                    {/* describe the event and its relationship to a series */}
                                    <EventFields
                                        onVisibilityChange={setVisibility}
                                        isPublished={
                                            !!currentEvent() && currentEvent()?.status !== "draft"
                                        }
                                        draft={draft()}
                                        isDuplicate={!!params.duplicate}
                                        directory={
                                            directory()
                                                ? {
                                                      ...directory()!,
                                                      series: directory()!.series.filter(
                                                          (item) =>
                                                              item._id === draft()?.seriesId ||
                                                              authority.canSeries(
                                                                  item._id,
                                                                  "organiser",
                                                              ),
                                                      ),
                                                  }
                                                : undefined
                                        }
                                        initialSeriesId={initialSeries()}
                                        allowStandalone={
                                            !!authority.current()?.isAdmin ||
                                            (!!draft() && !draft()?.seriesId)
                                        }
                                    />
                                    {/* keep programme details optional and quick to enter */}
                                    <ProgrammeFields draft={draft()} directory={directory()} />
                                </div>
                                <div class="editor-column">
                                    <OrganiserCard
                                        value={draft()?.primaryOrganiserId}
                                        coOrganisers={draft()?.coOrganiserIds}
                                        inherit
                                    />
                                    {/* enter real Zurich local dates and an optional map position */}
                                    <VenueFields draft={draft()} />
                                    <EventOptions
                                        draft={draft()}
                                        kind={kind()}
                                        setKind={setKind}
                                        questions={questions()}
                                        setQuestions={setQuestions}
                                        confirmedAt={
                                            params.edit ? currentEvent()?.confirmedAt : undefined
                                        }
                                    />
                                    <Show
                                        when={
                                            canPublish() &&
                                            isPublished() &&
                                            currentEvent() &&
                                            isTentative(currentEvent()!)
                                        }
                                    >
                                        <Card title="Tentative">
                                            <div class="form-actions">
                                                <Show
                                                    when={
                                                        currentEvent()?.confirmation
                                                            ?.isApprovalRequired &&
                                                        !currentEvent()?.approvedAt
                                                    }
                                                >
                                                    <button
                                                        class="button"
                                                        type="button"
                                                        disabled={isPending()}
                                                        onClick={() => void transition("approve")}
                                                    >
                                                        Approve event
                                                    </button>
                                                </Show>
                                                <button
                                                    class="button"
                                                    type="button"
                                                    disabled={isPending()}
                                                    onClick={() => void transition("confirm")}
                                                >
                                                    Confirm now
                                                </button>
                                            </div>
                                            <Show when={currentEvent()?.approvedAt}>
                                                <p>Team approval recorded</p>
                                            </Show>
                                        </Card>
                                    </Show>
                                    <Show
                                        when={
                                            currentEvent()?.scheduleId &&
                                            authority.canSeries(
                                                currentEvent()?.seriesId,
                                                "organiser",
                                            )
                                        }
                                    >
                                        <a
                                            class="action-link"
                                            href={`/admin?section=series&schedule=${currentEvent()!.scheduleId}`}
                                        >
                                            Edit series schedule
                                        </a>
                                    </Show>
                                </div>
                            </div>
                            <FormMessage error={error()} success={success()} />
                        </Editor>
                        <Show when={canPublish() && isPublished() && currentEvent()}>
                            <EventMail eventId={currentEvent()!.id} />
                        </Show>
                    </Show>
                </Show>
            </Page>
        </>
    );
}
