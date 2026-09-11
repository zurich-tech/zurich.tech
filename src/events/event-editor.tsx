import { For, Index, Show, type Setter } from "solid-js";
import type { Doc } from "../../convex/_generated/dataModel";
import { getDirectory } from "../organisations/queries";
import { civilTime } from "./time";
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
                        value={
                            props.isDuplicate
                                ? `${props.draft?.slug}-new`
                                : (props.draft?.slug ?? "")
                        }
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
            <p>All dates and times are Europe/Zurich.</p>
            <div class="form-columns">
                <label>
                    Starts
                    <input
                        type="datetime-local"
                        name="startsAt"
                        required
                        value={props.draft ? civilTime(props.draft!.startsAt) : ""}
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
                Venue & address
                <input
                    name="location"
                    required
                    value={props.draft?.location ?? ""}
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
                        value={props.draft?.latitude ?? ""}
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
                        value={props.draft?.longitude ?? ""}
                    />
                </label>
            </div>
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
    return (
        <Card title="People and programme">
            <label>
                Speakers <span>One per line: name | affiliation | links | photo | dark photo</span>
                <textarea
                    name="speakers"
                    rows="3"
                    value={
                        props.draft?.speakers
                            .map(
                                (item) =>
                                    `${item.name} | ${item.title} | ${(item.links ?? []).join(", ")} | ${item.imageUrl ?? ""} | ${item.imageDarkUrl ?? ""}`,
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
                        props.draft?.agenda
                            .map((item) => `${item.time} | ${item.title}`)
                            .join("\n") ?? ""
                    }
                />
            </label>
            <label>
                Hosts & supporters <span>Hold Command / Ctrl to select several</span>
                <select multiple name="organisations">
                    <For each={props.directory?.organisations}>
                        {(item) => (
                            <option
                                value={item._id}
                                selected={props.draft?.organisations.includes(item._id)}
                            >
                                {item.name}
                            </option>
                        )}
                    </For>
                </select>
            </label>
        </Card>
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
                Registration happens
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
                            <option value="automatic">Automatic confirmation</option>
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
                            value={native()?.capacity ?? ""}
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
