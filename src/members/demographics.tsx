import { CountryFields } from "./countries";
import { TopicFields } from "../topics/fields";
import { Suspense } from "solid-js";
import { Empty } from "../components/empty";
import { startTransition, createResource, createSignal, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import {
    demographicOptions,
    demographicLabels,
    participationOptions,
    motivationOptions,
    type Demographics as Answers,
} from "../../convex/members/demographics";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { savedEditor, Editor, FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";
import "../topics/topics.css";

/** Read optional survey fields, using empty values to clear answers. */
export function readDemographics(fields: FormData): Answers {
    // collect only answered questions
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(demographicOptions)) {
        if (key === "roles" || key === "languages") {
            const values = fields.getAll(key === "roles" ? "role" : "language").map(String);
            if (values.length) result[key] = values;
        } else {
            const value = String(fields.get(key) ?? "");
            if (value) result[key] = value;
        }
    }

    // collect residence and citizenship independently
    const residence = String(fields.get("residence") ?? "");
    if (residence) result.residence = residence;
    const citizenships = fields.getAll("citizenship").map(String).filter(Boolean);
    if (citizenships.length) result.citizenships = citizenships;

    return result as Answers;
}

/** Read private preferences separately from public profile and email consent. */
export function readCommunity(fields: FormData) {
    return {
        demographics: readDemographics(fields),
        interests: fields.getAll("interest").map(String),
        participation: fields.getAll("participation").map(String),
        motivations: fields.getAll("motivation").map(String),
    };
}

/** Optional private survey shown after sign-up and in account settings. */
export function Demographics(props: { onComplete?: () => void }) {
    const [current, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.members.audience.current, {}),
    );
    const [error, setError] = createSignal<string>();
    const [success, setSuccess] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);

    /** Save only selected answers; blank values remove previous answers. */
    async function save(event: SubmitEvent) {
        event.preventDefault();
        const editor = event.currentTarget as HTMLFormElement;
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        const answers = readCommunity(fields);
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await (
                await memberClient()
            ).mutation(api.members.audience.save, {
                ...answers,
                isOnboarding: !!props.onComplete,
            });
            savedEditor(editor);
            await startTransition(refetch);
            setSuccess("Community profile saved.");
            props.onComplete?.();
        } catch (caught) {
            setError(errorMessage(caught, "Could not save your answers."));
        } finally {
            setIsPending(false);
        }
    }

    /** Continue without answering and avoid repeating the welcome prompt. */
    async function skip() {
        setIsPending(true);
        setError(undefined);
        try {
            await (await memberClient()).mutation(api.members.audience.skip, {});
            props.onComplete?.();
        } catch (caught) {
            setError(errorMessage(caught, "Could not continue."));
            setIsPending(false);
        }
    }

    return (
        <Card
            title="Community"
            toolbar={
                <Suspense>
                    <Show when={current.latest}>
                        <button
                            type="submit"
                            form="demographics-editor"
                            class="button button--primary"
                            disabled={isPending()}
                        >
                            {isPending() ? "Saving…" : props.onComplete ? "Continue" : "Save"}
                        </button>
                    </Show>
                </Suspense>
            }
        >
            <Show when={current.error}>
                <p class="form-error">
                    {errorMessage(current.error, "Could not load your answers.")}
                </p>
            </Show>
            <Show when={current()}>
                {(value) => (
                    <Editor
                        id="demographics-editor"
                        class="editor"
                        onSubmit={save}
                        actions={() => (
                            <div class="form-actions">
                                <button class="button button--primary" disabled={isPending()}>
                                    {isPending()
                                        ? "Saving…"
                                        : props.onComplete
                                          ? "Continue"
                                          : "Save"}
                                </button>
                                <Show when={props.onComplete}>
                                    <button
                                        type="button"
                                        class="button"
                                        disabled={isPending()}
                                        onClick={skip}
                                    >
                                        Skip for now
                                    </button>
                                </Show>
                            </div>
                        )}
                    >
                        <CommunityFields values={value()} />

                        <FormMessage error={error()} success={success()} />
                    </Editor>
                )}
            </Show>
        </Card>
    );
}

/** Collect interests and participation preferences before optional private background answers. */
export function CommunityFields(props: {
    values: {
        demographics: Answers;
        interests: string[];
        participation: string[];
        motivations: string[];
    };
}) {
    return (
        <>
            {/* interests */}
            <section class="community-section">
                <p class="survey-intro">
                    All questions are optional. Answers are private and shown only as grouped
                    statistics.
                </p>
                <TopicFields
                    label="What do you like?"
                    isInterests
                    name="interest"
                    values={props.values.interests}
                />
            </section>

            {/* motivations */}
            <section class="community-section">
                <fieldset class="survey-choice">
                    <legend>What brings you here?</legend>
                    <div class="choice-grid">
                        <For each={motivationOptions}>
                            {(option) => (
                                <label class="checkbox">
                                    <input
                                        type="checkbox"
                                        name="motivation"
                                        value={option.value}
                                        checked={props.values.motivations.includes(option.value)}
                                    />
                                    {option.label}
                                </label>
                            )}
                        </For>
                    </div>
                </fieldset>
            </section>

            {/* participation */}
            <section class="community-section">
                <h3>How would you like to get involved?</h3>
                <div class="choice-grid">
                    <For each={participationOptions}>
                        {(option) => (
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    name="participation"
                                    value={option.value}
                                    checked={props.values.participation.includes(option.value)}
                                />
                                {option.label}
                            </label>
                        )}
                    </For>
                </div>
            </section>

            {/* background */}
            <section class="community-section">
                <DemographicFields values={props.values.demographics} />
            </section>

            {/* residence and citizenship */}
            <section class="community-section">
                <h3>Where are you from?</h3>
                <CountryFields values={props.values.demographics} />
            </section>

            {/* languages */}
            <section class="community-section">
                <LanguageFields values={props.values.demographics} />
            </section>
        </>
    );
}

/** Collect optional background answers; empty controls clear previous answers. */
export function DemographicFields(props: { values: Answers }) {
    return (
        <>
            <fieldset class="survey-choice">
                <legend>{demographicLabels.roles}</legend>
                <p class="survey-intro">Select all that apply.</p>
                <div class="choice-grid role-choices">
                    <For each={demographicOptions.roles}>
                        {(option) => (
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    name="role"
                                    value={option.value}
                                    checked={props.values.roles?.includes(option.value) ?? false}
                                />
                                {option.label}
                            </label>
                        )}
                    </For>
                </div>
            </fieldset>
            <div class="demographic-fields">
                <For each={["experience", "education", "age"] as const}>
                    {(field) => (
                        <label>
                            {demographicLabels[field]}
                            <select name={field} value={props.values[field] ?? ""}>
                                <option value="">Not answered</option>
                                <For each={demographicOptions[field]}>
                                    {(option) => (
                                        <option value={option.value}>{option.label}</option>
                                    )}
                                </For>
                            </select>
                            <Show when={field === "education"}>
                                <small>Highest completed qualification.</small>
                            </Show>
                        </label>
                    )}
                </For>
            </div>
        </>
    );
}

/** Self-reported working languages, independent of citizenship or residence. */
function LanguageFields(props: { values: Answers }) {
    return (
        <fieldset class="survey-choice">
            <legend>{demographicLabels.languages}</legend>
            <p class="survey-intro">With at least professional fluency.</p>
            <div class="choice-grid">
                <For each={demographicOptions.languages}>
                    {(option) => (
                        <label class="checkbox">
                            <input
                                type="checkbox"
                                name="language"
                                value={option.value}
                                checked={props.values.languages?.includes(option.value) ?? false}
                            />
                            {option.label}
                        </label>
                    )}
                </For>
            </div>
        </fieldset>
    );
}

/** Team-only charts contain aggregate counts rather than member identities. */
export function Audience() {
    const [summary] = createResource(async () =>
        (await memberClient()).query(api.members.audience.summary, {}),
    );

    return (
        <Card title="Audience">
            <p class="survey-intro">
                Optional, self-reported answers from active accounts. Small groups are hidden; these
                results describe respondents, not every member.
            </p>
            <Show when={summary.error}>
                <p class="form-error">
                    {errorMessage(summary.error, "Could not load audience stats.")}
                </p>
            </Show>
            <div class="audience-charts">
                <For each={summary()}>
                    {(chart) => (
                        <section>
                            <h3>{chart.label}</h3>
                            <p class="text-soft">
                                {chart.responses} respondents · {chart.total} active accounts
                            </p>
                            <Show when={chart.multiple}>
                                <p class="text-soft">
                                    Multiple selections; percentages may exceed 100%.
                                </p>
                            </Show>
                            <Show
                                when={chart.responses > 0}
                                fallback={<Empty title="No responses" />}
                            >
                                <Show when={chart.groups.length === 0}>
                                    <p class="text-soft">
                                        No country group has five responses yet.
                                    </p>
                                </Show>
                                <For each={chart.groups}>
                                    {(group) => (
                                        <div class="audience-bar">
                                            <span>{group.label}</span>
                                            <span>
                                                {group.count === null
                                                    ? "<5"
                                                    : `${group.count} · ${group.percentage}%`}
                                            </span>
                                            <meter
                                                min="0"
                                                max={Math.max(chart.responses, 1)}
                                                value={group.count ?? 0}
                                                aria-label={`${group.label}: ${group.count === null ? "fewer than five responses" : group.count}`}
                                            />
                                        </div>
                                    )}
                                </For>
                            </Show>
                        </section>
                    )}
                </For>
            </div>
        </Card>
    );
}
