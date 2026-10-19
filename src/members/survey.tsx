import { createResource, createSignal, For, onMount, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import {
    answerQuestion,
    surveyLabels,
    surveySections,
    demographicOptions,
    motivationOptions,
    participationOptions,
    surveyAnswer,
    surveyQuestions,
    surveyPosition,
    type CommunityAnswers,
    type SurveyQuestion,
} from "../../convex/members/demographics";
import { countries } from "../../convex/members/countries";
import { retiredInterests } from "../../convex/members/interests";
import { allLanguages } from "../../convex/members/languages";
import { useAccount } from "../auth";
import { memberClient } from "../auth/convex";
import { FormMessage } from "../components/form";
import { errorMessage } from "../components/errors";
import { CommunityFields, readCommunity } from "./demographics";
import { getTopics } from "../topics/queries";
import { SurveyWrites } from "./saving";
import { useUnsavedChanges } from "../components/unsaved";
import "./survey.css";

/** Anonymous answers stay in this tab until explicitly saved after sign-in. */
const draftKey = "zurich-survey-draft";
/** A null entry records a skip rather than an empty answer. */
type Draft = Partial<Record<SurveyQuestion, string[] | null>>;
/** Empty answers do not imply consent or a public profile. */
const empty: CommunityAnswers = {
    demographics: {},
    interests: [],
    participation: [],
    motivations: [],
};
/** Question labels shared by navigation and the answer overview. */
const labels = surveyLabels;

/** Offer optional questions one at a time, without replacing the full profile editor. */
export function Survey(props: { onComplete?: () => void }) {
    const account = useAccount();
    return (
        <Show when={!account.isPending()} fallback={<p role="status">Loading your answers…</p>}>
            <Show
                when={!account.error()}
                fallback={
                    <FormMessage
                        error={
                            account.error()?.message ||
                            "Could not check your sign-in. Please reload and try again."
                        }
                    />
                }
            >
                <Show when={account.user()?.id ?? "anonymous"} keyed>
                    {(owner) => (
                        <SurveyForm
                            accountId={owner === "anonymous" ? undefined : owner}
                            onComplete={props.onComplete}
                        />
                    )}
                </Show>
            </Show>
        </Show>
    );
}

/** Isolate drafts and requests to the currently displayed account session. */
function SurveyForm(props: { accountId?: string; onComplete?: () => void }) {
    const topics = getTopics.use(() => []);
    const [answers, setAnswers] = createSignal<CommunityAnswers>(empty);
    const [visited, setVisited] = createSignal<SurveyQuestion[]>([]);
    const [draft, setDraft] = createSignal<Draft>({});
    const [step, setStep] = createSignal(0);
    const [view, setView] = createSignal<"question" | "edit" | "overview" | "complete">("question");
    const [error, setError] = createSignal<string>();
    const [isPending, setIsPending] = createSignal(false);
    const [saveError, setSaveError] = createSignal<string>();
    const writes = new SurveyWrites(async (answers) =>
        (await memberClient()).mutation(api.members.audience.saveDraft, { answers }),
    );
    useUnsavedChanges(() => writes.isPending);
    let form: HTMLFormElement | undefined;
    let heading: HTMLHeadingElement | undefined;
    let survey: HTMLDivElement | undefined;
    const question = () => surveyQuestions[step()];
    const isQuestion = () => view() === "question" || view() === "edit";
    const next = () =>
        view() === "edit" || step() === surveyQuestions.length - 1 ? "overview" : step() + 1;

    // restore only well-formed drafts; never silently claim a corrupt draft was saved
    onMount(() => {
        try {
            const stored = sessionStorage.getItem(draftKey);
            if (!stored) return;
            const value: unknown = JSON.parse(stored);
            if (!value || typeof value !== "object" || Array.isArray(value))
                throw new Error("Could not restore your draft.");
            let restored = empty;
            for (const [key, values] of Object.entries(value)) {
                if (
                    !surveyQuestions.includes(key as SurveyQuestion) ||
                    (values !== null &&
                        (!Array.isArray(values) || values.some((item) => typeof item !== "string")))
                ) {
                    throw new Error("Could not restore your draft.");
                }
                if (values !== null)
                    restored = answerQuestion(restored, key as SurveyQuestion, values);
            }
            setDraft(value as Draft);
            if (!props.accountId) {
                setAnswers(restored);
                const completed = Object.keys(value) as SurveyQuestion[];
                setVisited(completed);
                resume(restored, completed);
            }
        } catch (caught) {
            setError(errorMessage(caught, "Could not restore your draft."));
        }
    });

    // load saved answers only for the authenticated account
    const [current] = createResource(
        () => props.accountId,
        async () => {
            const value = await (await memberClient()).query(api.members.audience.current, {});
            setAnswers(value);
            setVisited(value.surveyVisited);
            resume(value, value.surveyVisited, !!value.surveyCompletedAt);

            return value;
        },
    );

    /** Resume the first unseen, unanswered question; completed surveys open their overview. */
    function resume(value: CommunityAnswers, completed: SurveyQuestion[], isComplete = false) {
        const position = surveyPosition(value, completed, isComplete);
        setStep(typeof position === "number" ? position : 0);
        setView(position === "overview" ? "overview" : "question");
    }

    /** Save locally before moving; persist account changes without blocking navigation. */
    function move(target: number | "overview", isSkip = false) {
        if (isPending()) return;
        setError(undefined);
        try {
            const key = question();
            const values = isSkip
                ? undefined
                : surveyAnswer(readCommunity(new FormData(form)), key);
            if (props.accountId) {
                const previous = surveyAnswer(answers(), key);
                const isChanged =
                    values !== undefined &&
                    (previous.length !== values.length ||
                        previous.some((value, index) => value !== values[index]));
                if (!visited().includes(key) || isChanged) writes.add({ question: key, values });
            } else {
                const next = { ...draft(), [key]: values ?? draft()[key] ?? null };
                sessionStorage.setItem(draftKey, JSON.stringify(next));
                setDraft(next);
            }
            if (values !== undefined) setAnswers((value) => answerQuestion(value, key, values));
            setVisited((value) => [...new Set([...value, key])]);
            navigate(target);
            if (props.accountId) void saveAnswers();
        } catch (caught) {
            setError(errorMessage(caught, "Could not save your answer. Please try again."));
        }
    }

    /** Keep failures visible and queued while allowing the survey to remain usable. */
    async function saveAnswers() {
        try {
            await writes.flush();
            setSaveError(undefined);
        } catch (caught) {
            setSaveError(
                `Your latest answers have not been saved. ${errorMessage(caught, "Please retry before leaving.")}`,
            );
        }
    }

    /** Move focus with the question so keyboard and screen-reader users retain their place. */
    function navigate(target: number | "overview", isEditing = false) {
        if (typeof target === "number") {
            setStep(target);
            setView(isEditing ? "edit" : "question");
        } else {
            setView(target);
        }
        focusQuestion();
    }

    /** Keep the progress header visible when changing questions, including on small screens. */
    function focusQuestion() {
        queueMicrotask(() => {
            survey?.scrollIntoView({ block: "start" });
            heading?.focus({ preventScroll: true });
        });
    }

    /** Save only this tab's explicit answers, preserving all other account answers. */
    async function importDraft() {
        setIsPending(true);
        setError(undefined);
        try {
            const client = await memberClient();
            await client.mutation(api.members.audience.saveDraft, {
                answers: surveyQuestions
                    .filter((key) => key in draft())
                    .map((question) => ({ question, values: draft()[question] ?? undefined })),
            });
            const value = await client.query(api.members.audience.current, {});
            sessionStorage.removeItem(draftKey);
            setDraft({});
            setAnswers(value);
            setVisited(value.surveyVisited);
            resume(value, value.surveyVisited, !!value.surveyCompletedAt);
        } catch (caught) {
            setError(errorMessage(caught, "Could not save your draft. Please try again."));
        } finally {
            setIsPending(false);
        }
    }

    /** Finish onboarding without requiring any remaining question. */
    async function finish() {
        setIsPending(true);
        setError(undefined);
        try {
            await writes.flush();
            setSaveError(undefined);
            await (await memberClient()).mutation(api.members.audience.finish, {});
            props.onComplete?.();
            setView("complete");
            focusQuestion();
        } catch (caught) {
            setError(errorMessage(caught, "Could not finish. Please try again."));
        } finally {
            setIsPending(false);
        }
    }

    return (
        <div class="survey" ref={survey}>
            <Show when={!current.loading} fallback={<p role="status">Loading your answers…</p>}>
                <Show
                    when={!current.error}
                    fallback={
                        <FormMessage
                            error={errorMessage(current.error, "Could not load your answers.")}
                        />
                    }
                >
                    <Show
                        when={props.accountId && Object.keys(draft()).length > 0}
                        fallback={
                            <>
                                <Show when={isQuestion()}>
                                    <header class="survey-header">
                                        <p>
                                            {
                                                surveySections.find((section) =>
                                                    (
                                                        section.questions as readonly string[]
                                                    ).includes(question()),
                                                )?.label
                                            }
                                            {` · Question ${step() + 1} of ${surveyQuestions.length}`}
                                        </p>
                                        <Show when={view() === "question"}>
                                            <button
                                                type="button"
                                                class="action-link"
                                                disabled={isPending()}
                                                onClick={() => move("overview")}
                                            >
                                                All questions
                                            </button>
                                        </Show>
                                    </header>
                                </Show>
                                <Show when={view() !== "complete"}>
                                    <progress
                                        aria-label="Questions visited or answered"
                                        max={surveyQuestions.length}
                                        value={
                                            surveyQuestions.filter(
                                                (key) =>
                                                    visited().includes(key) ||
                                                    surveyAnswer(answers(), key).length,
                                            ).length
                                        }
                                    />
                                    <p class="survey-intro">
                                        All answers are optional and private.
                                    </p>
                                </Show>
                                <Show when={isQuestion()}>
                                    <Show when={question()} keyed>
                                        {(key) => (
                                            <form
                                                ref={form}
                                                class="editor survey-question"
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    void move(next());
                                                }}
                                            >
                                                <h2 class="sr-only" ref={heading} tabindex="-1">
                                                    {labels[key]}
                                                </h2>
                                                <fieldset
                                                    disabled={isPending()}
                                                    class="survey-controls"
                                                >
                                                    <CommunityFields
                                                        question={key}
                                                        values={answers()}
                                                    />
                                                </fieldset>
                                                <div class="survey-actions">
                                                    <button
                                                        type="button"
                                                        class="button"
                                                        disabled={
                                                            isPending() ||
                                                            (view() !== "edit" && step() === 0)
                                                        }
                                                        onClick={() =>
                                                            view() === "edit"
                                                                ? navigate("overview")
                                                                : move(step() - 1)
                                                        }
                                                    >
                                                        {view() === "edit" ? "Cancel" : "Back"}
                                                    </button>
                                                    <Show when={view() !== "edit"}>
                                                        <button
                                                            type="button"
                                                            class="action-link"
                                                            disabled={isPending()}
                                                            onClick={() => move(next(), true)}
                                                        >
                                                            Skip
                                                        </button>
                                                    </Show>
                                                    <button
                                                        class="button button--primary"
                                                        disabled={isPending()}
                                                    >
                                                        {isPending()
                                                            ? "Saving…"
                                                            : view() === "edit"
                                                              ? "Save answer"
                                                              : step() ===
                                                                  surveyQuestions.length - 1
                                                                ? "Review answers"
                                                                : "Next"}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </Show>
                                </Show>
                                <Show when={view() === "overview"}>
                                    <h2 ref={heading} tabindex="-1">
                                        Your answers
                                    </h2>
                                    <div class="survey-overview">
                                        <For each={surveyQuestions}>
                                            {(key, index) => (
                                                <div>
                                                    <div>
                                                        <h3>{labels[key]}</h3>
                                                        <p
                                                            classList={{
                                                                "survey-answer":
                                                                    surveyAnswer(answers(), key)
                                                                        .length > 0,
                                                            }}
                                                        >
                                                            {answerLabel(
                                                                answers(),
                                                                key,
                                                                topics() ?? [],
                                                            ) ||
                                                                (visited().includes(key)
                                                                    ? "Skipped"
                                                                    : "Not answered")}
                                                        </p>
                                                    </div>
                                                    <button
                                                        class="action-link"
                                                        disabled={isPending()}
                                                        onClick={() => navigate(index(), true)}
                                                    >
                                                        Edit
                                                        <span class="sr-only"> {labels[key]}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                    <div class="survey-footer-actions">
                                        <Show
                                            when={
                                                surveyPosition(answers(), visited()) !== "overview"
                                            }
                                        >
                                            <button
                                                class="button"
                                                disabled={isPending()}
                                                onClick={() =>
                                                    navigate(surveyPosition(answers(), visited()))
                                                }
                                            >
                                                Continue survey
                                            </button>
                                        </Show>
                                        <Show
                                            when={props.accountId}
                                            fallback={
                                                <a
                                                    class="button button--primary"
                                                    href="/sign-in?next=%2Fsurvey"
                                                >
                                                    Sign in to save your answers
                                                </a>
                                            }
                                        >
                                            <button
                                                class="button button--primary"
                                                disabled={isPending()}
                                                onClick={finish}
                                            >
                                                Done
                                            </button>
                                            <a class="action-link" href="/settings">
                                                Edit profile
                                            </a>
                                        </Show>
                                    </div>
                                </Show>
                                <Show when={view() === "complete"}>
                                    <section class="survey-complete">
                                        <h2 ref={heading} tabindex="-1">
                                            Thank you.
                                        </h2>
                                        <p>Your answers are saved.</p>
                                        <div class="survey-footer-actions">
                                            <a class="button button--primary" href="/events">
                                                Explore events
                                            </a>
                                            <button
                                                class="action-link"
                                                onClick={() => navigate("overview")}
                                            >
                                                Review answers
                                            </button>
                                        </div>
                                    </section>
                                </Show>
                            </>
                        }
                    >
                        <h2>Save your draft?</h2>
                        <p>
                            These answers will replace your saved answers to the same questions.
                            Questions you skipped will keep their existing answers.
                        </p>
                        <div class="survey-overview">
                            <For each={surveyQuestions.filter((key) => draft()[key] != null)}>
                                {(key) => (
                                    <div>
                                        <div>
                                            <h3>{labels[key]}</h3>
                                            <p
                                                classList={{
                                                    "survey-answer": draft()[key]!.length > 0,
                                                }}
                                            >
                                                {answerLabel(
                                                    answerQuestion(answers(), key, draft()[key]!),
                                                    key,
                                                    topics() ?? [],
                                                ) || "Not answered"}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                        <div class="survey-footer-actions">
                            <button
                                class="button button--primary"
                                disabled={isPending()}
                                onClick={importDraft}
                            >
                                Save answers to my account
                            </button>
                            <button
                                class="button"
                                disabled={isPending()}
                                onClick={() => {
                                    try {
                                        sessionStorage.removeItem(draftKey);
                                        setDraft({});
                                    } catch (caught) {
                                        setError(
                                            errorMessage(caught, "Could not discard your draft."),
                                        );
                                    }
                                }}
                            >
                                Discard draft
                            </button>
                        </div>
                    </Show>
                </Show>
            </Show>
            <Show when={saveError()}>
                <FormMessage error={saveError()} />
                <button type="button" class="action-link" onClick={() => void saveAnswers()}>
                    Retry saving answers
                </button>
            </Show>
            <FormMessage error={error()} />
        </div>
    );
}

/** Describe answers without exposing internal option codes. */
function answerLabel(
    answers: CommunityAnswers,
    question: SurveyQuestion,
    topics: { slug: string; name: string }[],
) {
    const options =
        question === "motivations"
            ? motivationOptions
            : question === "participation"
              ? participationOptions
              : question === "residence" || question === "citizenships"
                ? countries
                : question === "interests"
                  ? topics.map((topic) => ({
                        value: topic.slug,
                        label: retiredInterests[topic.slug] ?? topic.name,
                    }))
                  : question === "languages"
                    ? allLanguages
                    : demographicOptions[question];

    return surveyAnswer(answers, question)
        .map((value) => options.find((option) => option.value === value)?.label ?? value)
        .join(", ");
}
