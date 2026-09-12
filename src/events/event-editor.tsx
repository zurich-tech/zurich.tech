import { createEffect, createSignal, For, Index, Show, type Setter } from "solid-js";
import type { Doc } from "../../convex/_generated/dataModel";
import { getDirectory } from "../organisations/queries";
import { civilTime } from "./time";
import { AddressField } from "../components/address";
import { Card } from "../components/card";

/** Edit the event title, description and series. */
export function EventFields(props: {
    /** Existing revision, if editing or duplicating. */
    draft: Doc<"submissions"> | undefined;
    /** Clear fields that must be unique when duplicating. */
    isDuplicate: boolean;
    /** Series available for this event. */
    directory: Awaited<ReturnType<typeof getDirectory>> | undefined;
}) {
    return (
        <Card title="Event">
            <label>
                Title
                <input name="title" required maxlength="180" value={props.draft?.title ?? ""} />
            </label>
            <div class="form-columns">
                <label>
                    Slug
                    <input
                        name="slug"
                        required
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        value={props.isDuplicate ? "" : (props.draft?.slug ?? "")}
                        placeholder="builders-dinner-september"
                    />
                </label>
                <label>
                    Format
                    <select name="format" value={props.draft?.format ?? "talk"}>
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
                                    {value.charAt(0).toUpperCase() +
                                        value.slice(1).replace("_", " ")}
                                </option>
                            )}
                        </For>
                    </select>
                </label>
            </div>
            <label>
                Summary
                <textarea
                    name="summary"
                    maxlength="500"
                    rows="2"
                    value={props.draft?.summary ?? ""}
                />
            </label>
            <label>
                Description <span>Markdown supported</span>
                <textarea
                    name="description"
                    required
                    rows="8"
                    value={props.draft?.description ?? ""}
                />
            </label>
            <div class="form-columns">
                <label>
                    Series
                    <select name="series" value={props.draft?.seriesId ?? ""}>
                        <option value="">None</option>
                        <For each={props.directory?.series}>
                            {(item) => <option value={item._id}>{item.name}</option>}
                        </For>
                    </select>
                </label>
                <label>
                    Topics <span>Comma separated</span>
                    <input
                        name="topics"
                        value={props.draft?.topics.join(", ") ?? ""}
                        placeholder="robotics, hardware"
                    />
                </label>
            </div>
        </Card>
    );
}

/** Edit the event schedule and venue. */
export function VenueFields(props: {
    /** Existing event schedule and venue. */
    draft: Doc<"submissions"> | undefined;
}) {
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
                    required
                    maxlength="500"
                    value={props.draft?.location ?? ""}
                    placeholder="ETH AI Center"
                />
            </label>
            <AddressField value={props.draft} />
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
                                <label>
                                    Affiliation
                                    <input
                                        name="speakerTitle"
                                        maxlength="300"
                                        value={speaker().title}
                                        onInput={(event) =>
                                            updateSpeaker(index, {
                                                title: event.currentTarget.value,
                                            })
                                        }
                                    />
                                </label>
                            </div>
                            <label>
                                Links<span>One URL per line</span>
                                <textarea
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
                    onClick={() => setSpeakers((items) => [...items, { name: "", title: "" }])}
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
                    <legend>Hosts &amp; supporters</legend>
                    <div class="organiser-options">
                        <For each={props.directory?.organisations}>
                            {(item) => (
                                <label class="checkbox-label">
                                    <input
                                        type="checkbox"
                                        name="organisations"
                                        value={item._id}
                                        checked={props.draft?.organisations.includes(item._id)}
                                    />
                                    {item.name}
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
        <Card title="Registration">
            <label>
                Registration
                <select
                    value={props.kind}
                    onChange={(event) => props.setKind(event.currentTarget.value)}
                >
                    <option value="native">Here, on zurich.tech</option>
                    <option value="external">On another website</option>
                    <option value="none">No registration / drop-in</option>
                </select>
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
                        <select name="admission" value={native()?.admission ?? "automatic"}>
                            <option value="automatic">Automatic</option>
                            <option value="approval">Approval required</option>
                        </select>
                    </label>
                    <label>
                        Capacity <span>Leave blank for unlimited</span>
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
                        <select name="overflow" value={native()?.overflow ?? "waitlist"}>
                            <option value="waitlist">Keep a waitlist</option>
                            <option value="closed">Close registration</option>
                        </select>
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
        </Card>
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
