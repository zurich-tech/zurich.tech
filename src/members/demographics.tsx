import { TopicFields } from "../topics/fields";
import { Suspense } from "solid-js";
import { Empty } from "../components/empty";
import { startTransition, createResource, createSignal, createEffect, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import {
    demographicOptions,
    demographicLabels,
    participationOptions,
    type Demographics as Answers,
} from "../../convex/members/demographics";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { savedEditor, Editor, FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Read optional survey fields, using empty values to clear answers. */
export function readDemographics(fields: FormData): Answers {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(demographicOptions)) {
        if (key === "roles") {
            const values = fields.getAll("role").map(String);
            if (fields.get("rolesWithheld") === "on") result.roles = null;
            else if (values.length) result.roles = values;
        } else {
            const value = String(fields.get(key) ?? "");
            if (value) result[key] = value === "withheld" ? null : value;
        }
    }
    return result as Answers;
}

/** Read private preferences separately from public profile and email consent. */
export function readCommunity(fields: FormData) {
    return {
        demographics: readDemographics(fields),
        interests: fields.getAll("interest").map(String),
        participation: fields.getAll("participation").map(String),
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
            <p class="survey-intro">Optional. Private answers; shared only as grouped stats.</p>
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

/** Optional private background, followed by separate interests and participation preferences. */
export function CommunityFields(props: {
    values: { demographics: Answers; interests: string[]; participation: string[] };
}) {
    return (
        <>
            <section class="community-section">
                <h3>Community background</h3>
                <p class="survey-intro">Optional and private. Only grouped statistics are shown.</p>
                <DemographicFields values={props.values.demographics} />
            </section>
            <section class="community-section">
                <TopicFields label="Interests" name="interest" values={props.values.interests} />
                <p class="survey-intro">
                    Topics you care about. This does not subscribe you to emails.
                </p>
            </section>
            <section class="community-section">
                <h3>Get involved</h3>
                <p class="survey-intro">
                    What would you like to do? These private preferences do not grant access or
                    trigger emails.
                </p>
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
        </>
    );
}

/** Null is an explicit refusal; an empty control clears the answer. */
export function DemographicFields(props: { values: Answers }) {
    const [withheld, setWithheld] = createSignal(props.values.roles === null);
    createEffect(() => setWithheld(props.values.roles === null));
    return (
        <>
            <fieldset class="survey-choice">
                <legend>{demographicLabels.roles}</legend>
                <p class="survey-intro">Select all that apply.</p>
                <div class="choice-grid">
                    <For each={demographicOptions.roles}>
                        {(option) => (
                            <label class="checkbox">
                                <input
                                    type="checkbox"
                                    name="role"
                                    value={option.value}
                                    disabled={withheld()}
                                    checked={props.values.roles?.includes(option.value) ?? false}
                                />
                                {option.label}
                            </label>
                        )}
                    </For>
                </div>
                <label class="checkbox">
                    <input
                        type="checkbox"
                        name="rolesWithheld"
                        checked={withheld()}
                        onChange={(event) => setWithheld(event.currentTarget.checked)}
                    />
                    Prefer not to say
                </label>
            </fieldset>
            <div class="demographic-fields">
                <For each={["experience", "education", "age"] as const}>
                    {(field) => (
                        <label>
                            {demographicLabels[field]}
                            <select
                                name={field}
                                value={
                                    props.values[field] === null
                                        ? "withheld"
                                        : (props.values[field] ?? "")
                                }
                            >
                                <option value="">Not answered</option>
                                <For each={demographicOptions[field]}>
                                    {(option) => (
                                        <option value={option.value}>{option.label}</option>
                                    )}
                                </For>
                                <option value="withheld">Prefer not to say</option>
                            </select>
                        </label>
                    )}
                </For>
            </div>
        </>
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
