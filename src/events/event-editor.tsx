import { Select, Textarea } from "../components/field";
import { TopicFields } from "../topics/fields";
import { formats } from "../../convex/events/formats";
import { AffiliationFields } from "../members/affiliations";
import { SpeakerMember } from "./speaker";
import { createEffect, createSignal, For, Index, Show, type Setter } from "solid-js";
import type { Doc } from "../../convex/_generated/dataModel";
import { getDirectory } from "../organisations/queries";
import { civilTime } from "./time";
import { AddressField } from "../components/address";
import { Card } from "../components/card";

/** Edit the event title, description and series. */
export function EventFields(props: {
    initialSeriesId?: string;
    allowStandalone?: boolean;
    /** Existing revision, if editing or duplicating. */
    draft: Doc<"submissions"> | undefined;
    /** Clear fields that must be unique when duplicating. */
    isDuplicate: boolean;
    /** Published URLs stay stable for existing invitation links. */
    isPublished?: boolean;
    onVisibilityChange?: (visibility: "public" | "unlisted") => void;
    /** Series available for this event. */
    directory: Awaited<ReturnType<typeof getDirectory>> | undefined;
}) {
    let slugInput!: HTMLInputElement;
    const [seriesId, setSeriesId] = createSignal(
        props.draft?.seriesId ?? props.initialSeriesId ?? "",
    );
    const defaults = () =>
        props.directory?.series.find((item: Doc<"series">) => item._id === seriesId())?.topics ??
        [];
    const [topics, setTopics] = createSignal<string[]>(props.draft?.topics ?? defaults());
    createEffect(() => {
        const id = props.draft?.seriesId ?? props.initialSeriesId ?? "";
        const series = props.directory?.series.find((item: Doc<"series">) => item._id === id);
        setSeriesId(id);
        setTopics(props.draft?.topics ?? series?.topics ?? []);
    });
    return (
        <Card title="Event">
            <label>
                Title
                <input name="title" required maxlength="180" value={props.draft?.title ?? ""} />
            </label>
            <div class="form-columns">
                <div class="field event-slug">
                    <div class="event-slug__heading">
                        <label for="event-slug">Slug</label>
                        <Show when={!props.isPublished || props.isDuplicate}>
                            <button
                                type="button"
                                class="action-link"
                                onClick={() => {
                                    const suffix = Array.from(
                                        crypto.getRandomValues(new Uint8Array(8)),
                                        (byte) => byte.toString(16).padStart(2, "0"),
                                    ).join("");
                                    const base =
                                        slugInput.value.trim().replace(/-[a-f0-9]{16}$/, "") ||
                                        "event";
                                    slugInput.value = `${base}-${suffix}`;
                                    slugInput.dispatchEvent(new Event("input", { bubbles: true }));
                                }}
                            >
                                Add random suffix
                            </button>
                        </Show>
                    </div>
                    <input
                        id="event-slug"
                        class="field__control"
                        ref={slugInput}
                        readOnly={props.isPublished && !props.isDuplicate}
                        title={
                            props.isPublished && !props.isDuplicate
                                ? "Published URLs cannot change; existing invitation links keep working."
                                : undefined
                        }
                        name="slug"
                        required
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        value={props.isDuplicate ? "" : (props.draft?.slug ?? "")}
                        placeholder="builders-dinner-september"
                    />
                </div>
                <label>
                    Format
                    <Select name="format" value={props.draft?.format ?? "talk"}>
                        <For each={formats}>
                            {(option) => <option value={option.value}>{option.label}</option>}
                        </For>
                    </Select>
                </label>
            </div>
            <label>
                Visibility
                <Select
                    name="visibility"
                    value={props.draft?.visibility ?? "public"}
                    onChange={(event) =>
                        props.onVisibilityChange?.(
                            event.currentTarget.value as "public" | "unlisted",
                        )
                    }
                >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                </Select>
                <span>
                    Unlisted events are accessible to anyone with the link, but excluded from
                    listings and promotional emails.
                </span>
            </label>
            <label>
                Summary
                <Textarea
                    name="summary"
                    maxlength="500"
                    rows="2"
                    value={props.draft?.summary ?? ""}
                />
            </label>
            <label>
                Description <span>Markdown supported</span>
                <Textarea name="description" rows="8" value={props.draft?.description ?? ""} />
            </label>
            <div class="form-columns">
                <label>
                    Series
                    <Select
                        name="series"
                        value={seriesId()}
                        onChange={(event) => {
                            setSeriesId(event.currentTarget.value);
                            if (!props.draft) setTopics(defaults());
                        }}
                    >
                        <option value="" disabled={props.allowStandalone === false}>
                            None
                        </option>
                        <For
                            each={props.directory?.series.filter(
                                (item: Doc<"series">) =>
                                    item.status !== "archived" ||
                                    item._id === props.draft?.seriesId,
                            )}
                        >
                            {(item) => <option value={item._id}>{item.name}</option>}
                        </For>
                    </Select>
                </label>
                <div class="grid gap-3">
                    <TopicFields values={topics()} onChange={setTopics} />
                    <Show when={seriesId()}>
                        <button type="button" class="button" onClick={() => setTopics(defaults())}>
                            Use series topics
                        </button>
                    </Show>
                </div>
            </div>
        </Card>
    );
}

/** Edit the event schedule and venue. */
export function VenueFields(props: {
    /** Existing event schedule and venue. */
    draft: Doc<"submissions"> | undefined;
}) {
    const [addressKind, setAddressKind] = createSignal("public");
    createEffect(() => setAddressKind(props.draft?.addressAccess?.kind ?? "public"));
    const external = () =>
        props.draft?.addressAccess?.kind === "external" ? props.draft.addressAccess : undefined;
    return (
        <Card title="Time and place">
            <div class="form-columns">
                <label>
                    Starts
                    <input
                        type="datetime-local"
                        name="startsAt"
                        required
                        value={props.draft?.startsAt ? civilTime(props.draft.startsAt) : ""}
                    />
                </label>
                <label>
                    Ends
                    <input
                        type="datetime-local"
                        name="endsAt"
                        value={props.draft?.endsAt ? civilTime(props.draft!.endsAt!) : ""}
                    />
                </label>
            </div>
            <label>
                Venue
                <input
                    name="location"
                    maxlength="500"
                    value={props.draft?.location ?? ""}
                    placeholder="ETH AI Center"
                />
            </label>
            <span>
                Public venue name or city. Keep private arrival details in the address below.
            </span>
            <label>
                Address availability
                <Select
                    name="addressKind"
                    value={addressKind()}
                    onChange={(event) => setAddressKind(event.currentTarget.value)}
                >
                    <option value="public">Public</option>
                    <option value="confirmed">Confirmed attendees</option>
                    <option value="external">On another site</option>
                    <option value="unannounced">Not announced</option>
                </Select>
            </label>
            <Show when={addressKind() !== "unannounced"}>
                <AddressField value={props.draft} />
            </Show>
            <Show when={addressKind() === "confirmed"}>
                <p>
                    Address and map are shown to confirmed attendees and assigned editors, and
                    included in confirmation emails.
                </p>
            </Show>
            <Show when={addressKind() === "external"}>
                <label>
                    Address link
                    <input
                        name="addressUrl"
                        type="url"
                        required
                        value={
                            external()?.url ??
                            (props.draft?.registration.kind === "external"
                                ? props.draft.registration.url
                                : "")
                        }
                    />
                </label>
                <label>
                    Site name
                    <input
                        name="addressLabel"
                        placeholder="Luma"
                        maxlength="80"
                        value={external()?.label ?? ""}
                    />
                </label>
                <span>
                    We link to this site; it controls who can see the address. Any address entered
                    above is kept as an internal reference and is not shown to attendees.
                </span>
            </Show>
        </Card>
    );
}

/** Edit speakers, agenda and participating organisations. */
export function ProgrammeFields(props: {
    /** Speakers and agenda in the existing revision. */
    draft: Doc<"submissions"> | undefined;
    /** Organisations available for this event. */
    directory: Awaited<ReturnType<typeof getDirectory>> | undefined;
}) {
    const [speakers, setSpeakers] = createSignal<Doc<"submissions">["speakers"]>([]);
    const [agenda, setAgenda] = createSignal<Doc<"submissions">["agenda"]>([]);
    createEffect(() => {
        setSpeakers(props.draft?.speakers ?? []);
        setAgenda(props.draft?.agenda ?? []);
    });

    /** Update one speaker while keeping the other input values. */
    function updateSpeaker(
        index: number,
        changes: Partial<Doc<"submissions">["speakers"][number]>,
    ) {
        setSpeakers((items) =>
            items.map((item, position) => (position === index ? { ...item, ...changes } : item)),
        );
    }

    /** Update one agenda entry while keeping its position. */
    function updateSession(index: number, changes: Partial<Doc<"submissions">["agenda"][number]>) {
        setAgenda((items) =>
            items.map((item, position) => (position === index ? { ...item, ...changes } : item)),
        );
    }

    return (
        <>
            <Card title="Speakers">
                <Index each={speakers()}>
                    {(speaker, index) => (
                        <fieldset>
                            <legend>Speaker {index + 1}</legend>
                            <input type="hidden" name="speakerId" value={speaker().id ?? ""} />
                            <SpeakerMember
                                id={speaker().memberId}
                                onChange={(memberId, name) =>
                                    updateSpeaker(index, {
                                        memberId,
                                        ...(name ? { name, affiliations: undefined } : {}),
                                    })
                                }
                            />
                            <div class="form-columns">
                                <label>
                                    Name
                                    <input
                                        name="speakerName"
                                        required
                                        maxlength="120"
                                        value={speaker().name}
                                        onInput={(event) =>
                                            updateSpeaker(index, {
                                                name: event.currentTarget.value,
                                            })
                                        }
                                    />
                                </label>
                            </div>
                            <AffiliationFields
                                name="speakerAffiliations"
                                values={speaker().affiliations}
                                inherit={!!speaker().memberId}
                            />
                            <label>
                                Links<span>One URL per line</span>
                                <Textarea
                                    name="speakerLinks"
                                    rows="2"
                                    value={(speaker().links ?? []).join("\n")}
                                    onInput={(event) =>
                                        updateSpeaker(index, {
                                            links: event.currentTarget.value.split("\n"),
                                        })
                                    }
                                />
                            </label>
                            <details
                                class="speaker-photos"
                                open={!!(speaker().imageUrl || speaker().imageDarkUrl)}
                            >
                                <summary>Photos</summary>
                                <div class="form-columns">
                                    <label>
                                        Photo URL
                                        <input
                                            type="url"
                                            name="speakerImage"
                                            value={speaker().imageUrl ?? ""}
                                            onInput={(event) =>
                                                updateSpeaker(index, {
                                                    imageUrl: event.currentTarget.value,
                                                })
                                            }
                                        />
                                    </label>
                                    <label>
                                        Dark photo URL
                                        <input
                                            type="url"
                                            name="speakerImageDark"
                                            value={speaker().imageDarkUrl ?? ""}
                                            onInput={(event) =>
                                                updateSpeaker(index, {
                                                    imageDarkUrl: event.currentTarget.value,
                                                })
                                            }
                                        />
                                    </label>
                                </div>
                            </details>
                            <button
                                type="button"
                                class="button"
                                onClick={() =>
                                    setSpeakers((items) =>
                                        items.filter((_, position) => position !== index),
                                    )
                                }
                            >
                                Remove speaker
                            </button>
                        </fieldset>
                    )}
                </Index>
                <button
                    type="button"
                    class="button"
                    disabled={speakers().length >= 40}
                    onClick={() =>
                        setSpeakers((items) => [...items, { name: "", affiliations: [] }])
                    }
                >
                    Add speaker
                </button>
            </Card>
            <Card title="Programme">
                <Index each={agenda()}>
                    {(session, index) => (
                        <div class="form-columns">
                            <label>
                                Time
                                <input
                                    name="agendaTime"
                                    value={session().time}
                                    onInput={(event) =>
                                        updateSession(index, { time: event.currentTarget.value })
                                    }
                                />
                            </label>
                            <label>
                                Activity
                                <input
                                    name="agendaTitle"
                                    required
                                    value={session().title}
                                    onInput={(event) =>
                                        updateSession(index, { title: event.currentTarget.value })
                                    }
                                />
                            </label>
                            <button
                                type="button"
                                class="button"
                                onClick={() =>
                                    setAgenda((items) =>
                                        items.filter((_, position) => position !== index),
                                    )
                                }
                            >
                                Remove activity
                            </button>
                        </div>
                    )}
                </Index>
                <button
                    type="button"
                    class="button"
                    onClick={() => setAgenda((items) => [...items, { time: "", title: "" }])}
                >
                    Add activity
                </button>
                <fieldset>
                    <legend>Organisations</legend>
                    <div class="organiser-options">
                        <For each={props.directory?.organisations}>
                            {(item) => (
                                <label>
                                    {item.name}
                                    <Select
                                        name={`organisation:${item._id}`}
                                        value={
                                            props.draft?.partnerIds?.includes(item._id)
                                                ? "partner"
                                                : props.draft?.organisations.includes(item._id)
                                                  ? "supporter"
                                                  : "none"
                                        }
                                    >
                                        <option value="none">None</option>
                                        <option value="supporter">Host / supporter</option>
                                        <option value="partner">Partner</option>
                                    </Select>
                                </label>
                            )}
                        </For>
                    </div>
                </fieldset>
            </Card>
        </>
    );
}

/** Edit registration, capacity and application questions. */
export function RegistrationFields(props: {
    /** Existing registration policy. */
    draft: Doc<"submissions"> | undefined;
    /** Selected registration method. */
    kind: string;
    /** Select the registration method. */
    setKind: (kind: string) => void;
    /** Application questions in display order. */
    questions: { label: string; isRequired: boolean }[];
    /** Update the application questions. */
    setQuestions: Setter<{ label: string; isRequired: boolean }[]>;
}) {
    // retain the native and external policy types when reading defaults
    const native = () =>
        props.draft?.registration.kind === "native" ? props.draft.registration : undefined;
    const external = () =>
        props.draft?.registration.kind === "external" ? props.draft.registration : undefined;

    /** Update one question without replacing its input element. */
    function updateQuestion(
        index: number,
        changes: Partial<{ label: string; isRequired: boolean }>,
    ) {
        props.setQuestions((items) =>
            items.map((item, position) => (position === index ? { ...item, ...changes } : item)),
        );
    }

    return (
        <>
            <label>
                Registration
                <Select
                    value={props.kind}
                    onChange={(event) => props.setKind(event.currentTarget.value)}
                >
                    <option value="native">Here, on zurich.tech</option>
                    <option value="external">On another website</option>
                    <option value="none">No registration / drop-in</option>
                </Select>
            </label>
            <Show when={props.kind === "external"}>
                <label>
                    Registration URL
                    <input type="url" name="url" required value={external()?.url ?? ""} />
                </label>
                <label>
                    Capacity <span>Leave blank if unknown</span>
                    <input
                        type="number"
                        name="capacity"
                        min="1"
                        step="1"
                        value={external()?.capacity ?? ""}
                    />
                </label>
            </Show>
            <Show when={props.kind === "native"}>
                <div class="form-columns">
                    <label>
                        Admission
                        <Select name="admission" value={native()?.admission ?? "automatic"}>
                            <option value="automatic">Automatic</option>
                            <option value="approval">Approval required</option>
                        </Select>
                    </label>
                    <label>
                        Registration limit <span>Leave blank for unlimited</span>
                        <input
                            type="number"
                            name="capacity"
                            min="1"
                            step="1"
                            value={native() ? (native()!.capacity ?? "") : 200}
                        />
                    </label>
                </div>
                <div class="form-columns">
                    <label>
                        When full
                        <Select name="overflow" value={native()?.overflow ?? "waitlist"}>
                            <option value="waitlist">Keep a waitlist</option>
                            <option value="closed">Close registration</option>
                        </Select>
                    </label>
                    <label>
                        Registration closes <span>Defaults to event start</span>
                        <input
                            type="datetime-local"
                            name="closesAt"
                            value={native()?.closesAt ? civilTime(native()!.closesAt!) : ""}
                        />
                    </label>
                </div>
                <Index each={props.questions}>
                    {(question, index) => (
                        <QuestionField
                            question={question()}
                            number={index + 1}
                            onChange={(changes) => updateQuestion(index, changes)}
                            onRemove={() =>
                                props.setQuestions((items) =>
                                    items.filter((_, position) => position !== index),
                                )
                            }
                        />
                    )}
                </Index>
                <button
                    type="button"
                    class="button"
                    disabled={props.questions.length >= 10}
                    onClick={() =>
                        props.setQuestions((items) => [...items, { label: "", isRequired: false }])
                    }
                >
                    + Add attendee question
                </button>
            </Show>
        </>
    );
}

/** Edit one attendee question. */
function QuestionField(props: {
    /** Question text and answer requirement. */
    question: { label: string; isRequired: boolean };
    /** Position shown to assistive technology. */
    number: number;
    /** Apply the edited fields. */
    onChange: (changes: Partial<{ label: string; isRequired: boolean }>) => void;
    /** Remove this question. */
    onRemove: () => void;
}) {
    return (
        <div class="question-row">
            <input
                aria-label={`Question ${props.number}`}
                required
                maxlength="200"
                value={props.question.label}
                onInput={(event) => props.onChange({ label: event.currentTarget.value })}
            />
            <label class="checkbox">
                <input
                    type="checkbox"
                    checked={props.question.isRequired}
                    onChange={(event) =>
                        props.onChange({ isRequired: event.currentTarget.checked })
                    }
                />
                Required
            </label>
            <button type="button" onClick={props.onRemove}>
                Remove
            </button>
        </div>
    );
}
