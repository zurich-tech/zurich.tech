import { Suspense } from "solid-js";
import { Empty } from "../components/empty";
import { startTransition, createResource, createSignal, For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import {
    demographicOptions,
    type Demographics as Answers,
} from "../../convex/members/demographics";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
import { Editor, FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";

/** Read optional survey fields, using empty values to clear answers. */
export function readDemographics(fields: FormData): Answers {
    return Object.fromEntries(
        Object.keys(demographicOptions).map((key) => [
            key,
            String(fields.get(key) ?? "") || undefined,
        ]),
    ) as Answers;
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
        const fields = new FormData(event.currentTarget as HTMLFormElement);
        const answers = readDemographics(fields);
        setIsPending(true);
        setError(undefined);
        setSuccess(undefined);
        try {
            await (
                await memberClient()
            ).mutation(api.members.audience.save, {
                demographics: answers,
                isOnboarding: !!props.onComplete,
            });
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
                            {isPending()
                                ? "Saving…"
                                : props.onComplete
                                  ? "Continue"
                                  : "Save answers"}
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
                                          : "Save answers"}
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
                        <DemographicFields values={value().demographics} />

                        <FormMessage error={error()} success={success()} />
                    </Editor>
                )}
            </Show>
        </Card>
    );
}

/** Optional demographic fields shared by onboarding and the profile editor. */
export function DemographicFields(props: { values: Answers }) {
    return (
        <div class="demographic-fields">
            <For each={Object.keys(demographicOptions) as (keyof typeof demographicOptions)[]}>
                {(field) => (
                    <label>
                        {
                            { age: "Age range", occupation: "Occupation", education: "Education" }[
                                field
                            ]
                        }
                        <select name={field} value={props.values[field] ?? ""}>
                            <option value="">Prefer not to say</option>
                            <For each={demographicOptions[field]}>
                                {(option) => <option value={option.value}>{option.label}</option>}
                            </For>
                        </select>
                    </label>
                )}
            </For>
        </div>
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
                            <h3>
                                {
                                    {
                                        age: "Age range",
                                        occupation: "Occupation",
                                        education: "Education",
                                    }[chart.field]
                                }
                            </h3>
                            <p class="text-soft">{chart.responses} responses</p>
                            <Show
                                when={chart.responses > 0}
                                fallback={<Empty title="No responses" />}
                            >
                                <For each={chart.groups}>
                                    {(group) => (
                                        <div class="audience-bar">
                                            <span>{group.label}</span>
                                            <span>{group.count ?? "<5"}</span>
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
