import { getDirectory } from "../core/queries";
import { Card } from "../component/card";
import { Arrow } from "../component/arrow";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { createAsync, useSearchParams } from "@solidjs/router";
import type { Registration } from "../../convex/event";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { useAccount } from "../core/auth";

import { memberClient } from "../core/convex";
import { Page, PageHeader } from "../component/page";
import { Seo } from "../component/seo";
import { FormMessage } from "../component/form";
import { errorMessage } from "../core/error";
import { civilTime, timestamp } from "../core/time";

/** Create, duplicate, and revise an event in the organiser workspace. */
export default function Route() {
    const account = useAccount();
    const [params] = useSearchParams();
    const directory = createAsync(() => getDirectory());
    const [workspace] = createResource(
        () => account.user()?.id,
        async () => await (await memberClient()).query(api.workspace.events, {}),
    );
    const draft = () =>
        workspace()?.submissions.find((item) => item._id === (params.edit ?? params.duplicate));
    const [kind, setKind] = createSignal("native");
    const [questions, setQuestions] = createSignal<{ label: string; isRequired: boolean }[]>([]);
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    let form!: HTMLFormElement;
    createEffect(() => {
        const item = draft();
        if (item) {
            setKind(item.registration.kind);
            setQuestions(item.registration.kind === "native" ? item.registration.questions : []);
        }
    });

    /** Save one validated draft, optionally submitting or publishing it. */
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
            const id = await client.mutation(api.events.save, {
                id: params.edit ? draft()?._id : undefined,
                submit: intent !== "draft",
                title: text("title"),
                slug: text("slug"),
                description: text("description"),
                format: text("format") as Doc<"events">["format"],
                seriesId: text("series") ? (text("series") as Id<"series">) : undefined,
                topics: text("topics")
                    .split(",")
                    .map((tag) => tag.trim().toLowerCase())
                    .filter(Boolean),
                startsAt: timestamp(text("startsAt")),
                endsAt: text("endsAt") ? timestamp(text("endsAt")) : undefined,
                location: text("location"),
                latitude: text("latitude") ? Number(text("latitude")) : undefined,
                longitude: text("longitude") ? Number(text("longitude")) : undefined,
                registration: policy,
                organisations: fields.getAll("organisations") as Id<"organisations">[],
                speakers: text("speakers")
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => {
                        const [name, title = "", urls = ""] = line.split("|");
                        const links = urls
                            .split(",")
                            .map((url) => url.trim())
                            .filter(Boolean);

                        return { name: name.trim(), title: title.trim(), links };
                    }),
                agenda: text("agenda")
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => {
                        const [time, ...title] = line.split("|");

                        return { time: time.trim(), title: title.join("|").trim() };
                    }),
            });
            if (intent === "publish") await client.mutation(api.events.publish, { id });
            setSuccess(
                intent === "publish"
                    ? "Published. Your event is on the calendar."
                    : intent === "draft"
                      ? "Draft saved."
                      : "Submitted for team review.",
            );
            window.history.replaceState({}, "", `/submit?edit=${id}`);
            window.location.assign(`/admin?saved=${intent}`);
        } catch (caught) {
            setError(errorMessage(caught, "Could not save the event."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <Seo
                title="Submit event"
                description="Bring your talk, dinner, workshop, or hackathon to Zürich’s tech community."
            />
            <Page width="narrow">
                <PageHeader title={params.edit ? "Edit event" : "Submit an event"} />
                <Show
                    when={account.user()}
                    fallback={
                        <div class="empty-panel">
                            <h2>Sign in to submit an event</h2>
                            <p>
                                Sign in to create a draft and submit it for review. Regular
                                organisers can publish directly.
                            </p>
                            <a class="button button--primary" href="/sign-in">
                                Sign in to contribute <Arrow direction="external" />
                            </a>
                        </div>
                    }
                >
                    <Show when={workspace.error}>
                        <p role="alert" class="form-error">
                            {errorMessage(workspace.error, "Could not load your workspace.")}
                        </p>
                    </Show>
                    <Show when={workspace() && (!(params.edit || params.duplicate) || draft())}>
                        <form class="editor" ref={form} onSubmit={save}>
                            {/* describe the event and its relationship to a series */}
                            <Card title="Event">
                                <label>
                                    Event title
                                    <input
                                        name="title"
                                        required
                                        maxlength="180"
                                        value={draft()?.title ?? ""}
                                    />
                                </label>
                                <div class="form-columns">
                                    <label>
                                        URL slug
                                        <input
                                            name="slug"
                                            required
                                            pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                            value={
                                                params.duplicate
                                                    ? `${draft()?.slug}-new`
                                                    : (draft()?.slug ?? "")
                                            }
                                            placeholder="builders-dinner-september"
                                        />
                                    </label>
                                    <label>
                                        Format
                                        <select name="format" value={draft()?.format ?? "talk"}>
                                            <For
                                                each={[
                                                    "talk",
                                                    "dinner",
                                                    "meetup",
                                                    "workshop",
                                                    "hackathon",
                                                    "office_hours",
                                                    "other",
                                                ]}
                                            >
                                                {(value) => (
                                                    <option value={value}>
                                                        {value.replace("_", " ")}
                                                    </option>
                                                )}
                                            </For>
                                        </select>
                                    </label>
                                </div>
                                <label>
                                    Description <span>Markdown supported</span>
                                    <textarea
                                        name="description"
                                        required
                                        rows="8"
                                        value={draft()?.description ?? ""}
                                    />
                                </label>
                                <div class="form-columns">
                                    <label>
                                        Series
                                        <select name="series" value={draft()?.seriesId ?? ""}>
                                            <option value="">One-off / no series</option>
                                            <For each={directory()?.series}>
                                                {(item) => (
                                                    <option value={item._id}>{item.name}</option>
                                                )}
                                            </For>
                                        </select>
                                    </label>
                                    <label>
                                        Topics <span>Comma separated</span>
                                        <input
                                            name="topics"
                                            value={draft()?.topics.join(", ") ?? ""}
                                            placeholder="robotics, hardware"
                                        />
                                    </label>
                                </div>
                            </Card>
                            {/* enter real Zürich local dates and an optional map position */}
                            <Card title="Time and place">
                                <p>All dates and times are Europe/Zurich.</p>
                                <div class="form-columns">
                                    <label>
                                        Starts
                                        <input
                                            type="datetime-local"
                                            name="startsAt"
                                            required
                                            value={draft() ? civilTime(draft()!.startsAt) : ""}
                                        />
                                    </label>
                                    <label>
                                        Ends
                                        <input
                                            type="datetime-local"
                                            name="endsAt"
                                            value={
                                                draft()?.endsAt ? civilTime(draft()!.endsAt!) : ""
                                            }
                                        />
                                    </label>
                                </div>
                                <label>
                                    Venue & address
                                    <input
                                        name="location"
                                        required
                                        value={draft()?.location ?? ""}
                                        placeholder="Venue, street, Zürich — or an online meeting link"
                                    />
                                </label>
                                <div class="form-columns">
                                    <label>
                                        Latitude <span>Optional coordinates</span>
                                        <input
                                            type="number"
                                            step="any"
                                            min="-90"
                                            max="90"
                                            name="latitude"
                                            value={draft()?.latitude ?? ""}
                                        />
                                    </label>
                                    <label>
                                        Longitude
                                        <input
                                            type="number"
                                            step="any"
                                            min="-180"
                                            max="180"
                                            name="longitude"
                                            value={draft()?.longitude ?? ""}
                                        />
                                    </label>
                                </div>
                            </Card>
                            {/* compose admission, capacity, and overflow independently */}
                            <Card title="Registration">
                                <label>
                                    Registration happens
                                    <select
                                        value={kind()}
                                        onChange={(event) => setKind(event.currentTarget.value)}
                                    >
                                        <option value="native">Here, on zurich.tech</option>
                                        <option value="external">On another website</option>
                                        <option value="none">No registration / drop-in</option>
                                    </select>
                                </label>
                                <Show when={kind() === "external"}>
                                    <label>
                                        Registration URL
                                        <input
                                            type="url"
                                            name="url"
                                            required
                                            value={
                                                draft()?.registration.kind === "external"
                                                    ? (draft()!.registration as { url: string }).url
                                                    : ""
                                            }
                                        />
                                    </label>
                                </Show>
                                <Show when={kind() === "external"}>
                                    <label>
                                        Capacity <span>Leave blank if unknown</span>
                                        <input
                                            type="number"
                                            name="capacity"
                                            min="1"
                                            step="1"
                                            value={
                                                draft()?.registration.kind === "external"
                                                    ? ((
                                                          draft()!.registration as {
                                                              capacity?: number;
                                                          }
                                                      ).capacity ?? "")
                                                    : ""
                                            }
                                        />
                                    </label>
                                </Show>
                                <Show when={kind() === "native"}>
                                    <div class="form-columns">
                                        <label>
                                            Admission
                                            <select
                                                name="admission"
                                                value={
                                                    nativeRegistration(draft())?.admission ??
                                                    "automatic"
                                                }
                                            >
                                                <option value="automatic">
                                                    Automatic confirmation
                                                </option>
                                                <option value="approval">Organiser approval</option>
                                            </select>
                                        </label>
                                        <label>
                                            Capacity <span>Leave blank for unlimited</span>
                                            <input
                                                type="number"
                                                name="capacity"
                                                min="1"
                                                step="1"
                                                value={nativeRegistration(draft())?.capacity ?? ""}
                                            />
                                        </label>
                                    </div>
                                    <div class="form-columns">
                                        <label>
                                            When full
                                            <select
                                                name="overflow"
                                                value={
                                                    nativeRegistration(draft())?.overflow ??
                                                    "waitlist"
                                                }
                                            >
                                                <option value="waitlist">Keep a waitlist</option>
                                                <option value="closed">Close registration</option>
                                            </select>
                                        </label>
                                        <label>
                                            Registration closes <span>Defaults to event start</span>
                                            <input
                                                type="datetime-local"
                                                name="closesAt"
                                                value={
                                                    nativeRegistration(draft())?.closesAt
                                                        ? civilTime(
                                                              nativeRegistration(draft())!
                                                                  .closesAt!,
                                                          )
                                                        : ""
                                                }
                                            />
                                        </label>
                                    </div>
                                    <p>
                                        Applicants verify their email first. Approval does not
                                        reserve a seat; approved waitlisted attendees are promoted
                                        in signup order.
                                    </p>
                                    <For each={questions()}>
                                        {(question, index) => (
                                            <div class="question-row">
                                                <input
                                                    aria-label={`Question ${index() + 1}`}
                                                    required
                                                    maxlength="200"
                                                    value={question.label}
                                                    onInput={(event) =>
                                                        setQuestions((items) =>
                                                            items.map((item, i) =>
                                                                i === index()
                                                                    ? {
                                                                          ...item,
                                                                          label: event.currentTarget
                                                                              .value,
                                                                      }
                                                                    : item,
                                                            ),
                                                        )
                                                    }
                                                />
                                                <label class="checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={question.isRequired}
                                                        onChange={(event) =>
                                                            setQuestions((items) =>
                                                                items.map((item, i) =>
                                                                    i === index()
                                                                        ? {
                                                                              ...item,
                                                                              isRequired:
                                                                                  event
                                                                                      .currentTarget
                                                                                      .checked,
                                                                          }
                                                                        : item,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                    Required
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setQuestions((items) =>
                                                            items.filter((_, i) => i !== index()),
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                    <button
                                        type="button"
                                        class="button"
                                        disabled={questions().length >= 10}
                                        onClick={() =>
                                            setQuestions((items) => [
                                                ...items,
                                                { label: "", isRequired: false },
                                            ])
                                        }
                                    >
                                        + Add attendee question
                                    </button>
                                </Show>
                            </Card>
                            {/* keep programme details optional and quick to enter */}
                            <Card title="People and programme">
                                <label>
                                    Speakers{" "}
                                    <span>One per line: name | affiliation | link, link</span>
                                    <textarea
                                        name="speakers"
                                        rows="3"
                                        value={
                                            draft()
                                                ?.speakers.map(
                                                    (item) =>
                                                        `${item.name} | ${item.title} | ${(item.links ?? []).join(", ")}`,
                                                )
                                                .join("\n") ?? ""
                                        }
                                    />
                                </label>
                                <label>
                                    Agenda <span>One per line: time | activity</span>
                                    <textarea
                                        name="agenda"
                                        rows="3"
                                        value={
                                            draft()
                                                ?.agenda.map(
                                                    (item) => `${item.time} | ${item.title}`,
                                                )
                                                .join("\n") ?? ""
                                        }
                                    />
                                </label>
                                <label>
                                    Hosts & supporters{" "}
                                    <span>Hold Command / Ctrl to select several</span>
                                    <select multiple name="organisations">
                                        <For each={directory()?.organisations}>
                                            {(item) => (
                                                <option
                                                    value={item._id}
                                                    selected={draft()?.organisations.includes(
                                                        item._id,
                                                    )}
                                                >
                                                    {item.name}
                                                </option>
                                            )}
                                        </For>
                                    </select>
                                </label>
                            </Card>
                            <Show when={draft()?.reviewNote}>
                                <p class="review-note">Team feedback: {draft()?.reviewNote}</p>
                            </Show>
                            <div class="form-actions">
                                <button
                                    class="button"
                                    type="submit"
                                    value="draft"
                                    disabled={isPending()}
                                >
                                    Save draft
                                </button>
                                <button
                                    class="button button--primary"
                                    type="submit"
                                    value={workspace()?.viewer.canPublish ? "publish" : "review"}
                                    disabled={isPending()}
                                >
                                    {isPending()
                                        ? "Saving…"
                                        : workspace()?.viewer.canPublish
                                          ? "Publish event"
                                          : "Submit for review"}
                                </button>
                            </div>
                            <FormMessage error={error()} success={success()} />
                        </form>
                    </Show>
                </Show>
            </Page>
        </>
    );
}

/** Narrow a draft's native registration policy. */
function nativeRegistration(draft: Doc<"submissions"> | undefined) {
    return draft?.registration.kind === "native" ? draft.registration : undefined;
}
