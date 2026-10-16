import { CountryFields } from "./countries";
import { ArrowDownWideNarrow, ListOrdered } from "lucide-solid";
import { rankAnswers } from "./audience";
import { TopicFields } from "../topics/fields";
import { Empty } from "../components/empty";
import { createResource, createSignal, For, Show } from "solid-js";
import { Selection } from "../components/selection";
import { FilterSelect } from "../components/filter-select";
import { HistoryChart } from "../statistics/chart";
import "../statistics/style.css";
import { allLanguages } from "../../convex/members/languages";
import { api } from "../../convex/_generated/api";
import {
    demographicOptions,
    demographicLabels,
    participationOptions,
    motivationOptions,
    type Demographics as Answers,
    type SurveyQuestion,
} from "../../convex/members/demographics";
import { memberClient } from "../auth/convex";
import { Card } from "../components/card";
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
    else if (fields.has("residence")) result.residence = null;
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

/** Collect interests and participation preferences before optional private background answers. */
export function CommunityFields(props: {
    question?: SurveyQuestion;
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
            <Show when={!props.question || props.question === "interests"}>
                <section class="community-section">
                    <Show when={!props.question}>
                        <p class="survey-intro">All answers are optional and private.</p>
                    </Show>
                    <TopicFields
                        label="What are you interested in?"
                        isInterests
                        name="interest"
                        values={props.values.interests}
                    />
                </section>
            </Show>

            {/* motivations */}
            <Show when={!props.question || props.question === "motivations"}>
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
                                            checked={props.values.motivations.includes(
                                                option.value,
                                            )}
                                        />
                                        {option.label}
                                    </label>
                                )}
                            </For>
                        </div>
                    </fieldset>
                </section>
            </Show>

            {/* participation */}
            <Show when={!props.question || props.question === "participation"}>
                <section class="community-section">
                    <fieldset class="survey-choice">
                        <legend>How would you like to get involved?</legend>
                        <div class="choice-grid">
                            <For each={participationOptions}>
                                {(option) => (
                                    <label class="checkbox">
                                        <input
                                            type="checkbox"
                                            name="participation"
                                            value={option.value}
                                            checked={props.values.participation.includes(
                                                option.value,
                                            )}
                                        />
                                        {option.label}
                                    </label>
                                )}
                            </For>
                        </div>
                    </fieldset>
                </section>
            </Show>

            {/* event attendance */}
            <input
                type="hidden"
                name="eventsPerYear"
                value={props.values.demographics.eventsPerYear ?? ""}
            />
            <For
                each={(["eventsAttended", "eventFrequency"] as const).filter(
                    (field) => !props.question || props.question === field,
                )}
            >
                {(field) => (
                    <section class="community-section">
                        <fieldset class="survey-choice">
                            <legend>{demographicLabels[field]}</legend>
                            <Show when={field === "eventsAttended"}>
                                <p class="survey-intro">
                                    Including all ZurichNLP, ZurichCV, ZurichRobotics and ZurichAI
                                    events.
                                </p>
                            </Show>
                            <div class="choice-grid attendance-choices">
                                <For each={demographicOptions[field]}>
                                    {(option) => (
                                        <label class="checkbox">
                                            <input
                                                type="radio"
                                                name={field}
                                                value={option.value}
                                                checked={
                                                    props.values.demographics[field] ===
                                                    option.value
                                                }
                                            />
                                            {option.label}
                                        </label>
                                    )}
                                </For>
                            </div>
                        </fieldset>
                    </section>
                )}
            </For>

            {/* background */}
            <Show
                when={
                    !props.question ||
                    ["roles", "experience", "education", "age"].includes(props.question)
                }
            >
                <section class="community-section">
                    <DemographicFields
                        values={props.values.demographics}
                        question={props.question}
                    />
                </section>
            </Show>

            {/* residence and citizenship */}
            <Show
                when={
                    !props.question ||
                    props.question === "residence" ||
                    props.question === "citizenships"
                }
            >
                <section class="community-section">
                    <Show when={!props.question}>
                        <h3>Residence and citizenship</h3>
                    </Show>
                    <CountryFields values={props.values.demographics} question={props.question} />
                </section>
            </Show>

            {/* languages */}
            <Show when={!props.question || props.question === "languages"}>
                <section class="community-section">
                    <LanguageFields values={props.values.demographics} />
                </section>
            </Show>
        </>
    );
}

/** Collect optional background answers; empty controls clear previous answers. */
export function DemographicFields(props: { values: Answers; question?: SurveyQuestion }) {
    return (
        <>
            <Show when={!props.question || props.question === "roles"}>
                <fieldset class="survey-choice">
                    <legend>{demographicLabels.roles}</legend>
                    <div class="choice-grid role-choices">
                        <For
                            each={demographicOptions.roles.filter(
                                (option) =>
                                    option.value !== "other" ||
                                    props.values.roles?.includes("other"),
                            )}
                        >
                            {(option) => (
                                <label class="checkbox">
                                    <input
                                        type="checkbox"
                                        name="role"
                                        value={option.value}
                                        checked={
                                            props.values.roles?.includes(option.value) ?? false
                                        }
                                    />
                                    {option.label}
                                </label>
                            )}
                        </For>
                    </div>
                </fieldset>
            </Show>
            <div class="demographic-fields">
                <For
                    each={(["experience", "education", "age"] as const).filter(
                        (field) => !props.question || props.question === field,
                    )}
                >
                    {(field) => (
                        <Show
                            when={props.question}
                            fallback={
                                <label>
                                    {demographicLabels[field]}
                                    <select name={field} value={props.values[field] ?? ""}>
                                        <option value="">Not answered</option>
                                        <For
                                            each={demographicOptions[field].filter(
                                                (option) =>
                                                    field !== "education" ||
                                                    option.value !== "secondary" ||
                                                    props.values.education === "secondary",
                                            )}
                                        >
                                            {(option) => (
                                                <option value={option.value}>{option.label}</option>
                                            )}
                                        </For>
                                    </select>
                                    <Show when={field === "education"}>
                                        <small>
                                            Upper-secondary: Matura, A-levels or equivalent. Higher
                                            vocational: HF or federal professional qualifications.
                                        </small>
                                    </Show>
                                </label>
                            }
                        >
                            <fieldset class="survey-choice">
                                <legend>{demographicLabels[field]}</legend>
                                <Show when={field === "education"}>
                                    <p class="survey-intro">
                                        Upper-secondary: Matura, A-levels or equivalent. Higher
                                        vocational: HF or federal professional qualifications.
                                    </p>
                                </Show>
                                <div class="choice-grid">
                                    <For
                                        each={demographicOptions[field].filter(
                                            (option) =>
                                                field !== "education" ||
                                                option.value !== "secondary" ||
                                                props.values.education === "secondary",
                                        )}
                                    >
                                        {(option) => (
                                            <label class="checkbox">
                                                <input
                                                    type="radio"
                                                    name={field}
                                                    value={option.value}
                                                    checked={props.values[field] === option.value}
                                                />
                                                {option.label}
                                            </label>
                                        )}
                                    </For>
                                </div>
                            </fieldset>
                        </Show>
                    )}
                </For>
            </div>
        </>
    );
}

/** Self-reported working languages, independent of citizenship or residence. */
function LanguageFields(props: { values: Answers }) {
    const additional = allLanguages.filter(
        (language) =>
            !demographicOptions.languages.some((option) => option.value === language.value),
    );
    const [isExpanded, setExpanded] = createSignal(false);

    return (
        <fieldset class="survey-choice">
            <legend>{demographicLabels.languages}</legend>
            <p class="survey-intro">With at least professional fluency.</p>
            <div class="choice-grid language-choices">
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
            <Show
                when={
                    isExpanded() ||
                    props.values.languages?.some((value) =>
                        additional.some((language) => language.value === value),
                    )
                }
                fallback={
                    <button type="button" class="action-link" onClick={() => setExpanded(true)}>
                        Other languages
                    </button>
                }
            >
                <Selection
                    label="Other languages"
                    name="language"
                    options={additional}
                    isMultiple
                    values={(props.values.languages ?? []).filter((value) =>
                        additional.some((language) => language.value === value),
                    )}
                />
            </Show>
        </fieldset>
    );
}

/** Administrator-only charts contain aggregate counts rather than member identities. */
export function Audience() {
    const [summary, { refetch }] = createResource(async () =>
        (await memberClient()).query(api.members.audience.report, {}),
    );
    const [question, setQuestion] = createSignal("");
    const [isShowingEmpty, setShowingEmpty] = createSignal(false);
    const [sorts, setSorts] = createSignal<Record<string, boolean>>({});

    // preserve ordered scales while ranking categorical answers by default
    const isPopular = (field: string) =>
        sorts()[field] ??
        ![
            "eventsAttended",
            "eventFrequency",
            "eventsPerYear",
            "experience",
            "education",
            "age",
        ].includes(field);

    // do not read a rejected resource value, which throws past the inline retry state
    const report = () => (summary.error ? undefined : summary.latest);

    return (
        <Card title="Audience" class="audience-report">
            <p class="survey-intro">
                Self-reported survey answers. Percentages use each question's respondents, not all
                accounts.
            </p>
            <Show when={report()}>
                {(data) => (
                    <dl class="audience-totals">
                        <div>
                            <dt>Active accounts</dt>
                            <dd>
                                {data().total}
                                <div class="audience-signups">
                                    <HistoryChart label="Accounts" values={data().signupHistory} />
                                    <div class="audience-signup-dates">
                                        <span>{data().signupHistory[0]?.date}</span>
                                        <span>{data().signupHistory.at(-1)?.date}</span>
                                    </div>
                                </div>
                                <p class="audience-chart-note">
                                    Signup dates of currently active accounts
                                </p>
                            </dd>
                        </div>
                        <div>
                            <dt>Survey respondents</dt>
                            <dd>
                                <div class="audience-total-value">
                                    <span>
                                        {data().respondents} / {data().total}
                                    </span>
                                    <span class="audience-total-percent">
                                        {data().total
                                            ? Math.round((data().respondents / data().total) * 100)
                                            : 0}
                                        %
                                    </span>
                                </div>
                                <SurveyParticipation
                                    total={data().total}
                                    respondents={data().respondents}
                                    complete={data().fullyAnswered}
                                />
                                <p class="audience-chart-note">
                                    {data().finished} finished, including skips
                                </p>
                            </dd>
                        </div>
                    </dl>
                )}
            </Show>
            <Show when={report() && report()!.total > 0}>
                <div class="audience-toolbar">
                    <FilterSelect
                        label="Survey question"
                        value={question()}
                        onChange={setQuestion}
                        options={[
                            { value: "", label: "All questions" },
                            ...(report()?.questions ?? []).map((chart) => ({
                                value: chart.field,
                                label: chart.label,
                            })),
                        ]}
                    />
                    <label class="checkbox">
                        <input
                            type="checkbox"
                            checked={isShowingEmpty()}
                            onChange={(event) => setShowingEmpty(event.currentTarget.checked)}
                        />
                        Include zero responses
                    </label>
                </div>
            </Show>
            <Show when={summary.loading}>
                <p role="status">Loading audience…</p>
            </Show>
            <Show when={summary.error}>
                <p class="form-error" role="alert">
                    {errorMessage(summary.error, "Could not load audience stats.")}
                </p>
                <button
                    type="button"
                    class="button"
                    disabled={summary.loading}
                    onClick={() => void refetch()}
                >
                    Retry
                </button>
            </Show>
            <Show when={report()?.total === 0}>
                <Empty title="No active accounts" />
            </Show>
            <Show when={report() && report()!.total > 0}>
                <div class="audience-charts">
                    <For
                        each={report()?.questions.filter(
                            (chart) => !question() || chart.field === question(),
                        )}
                    >
                        {(chart) => (
                            <section>
                                <header class="audience-question-heading">
                                    <h3>{chart.label}</h3>
                                    <div class="audience-question-actions">
                                        <button
                                            type="button"
                                            class="audience-sort"
                                            aria-label={`Sort ${chart.label} by popularity`}
                                            aria-pressed={isPopular(chart.field)}
                                            title={
                                                isPopular(chart.field)
                                                    ? "Popular order; switch to natural order"
                                                    : "Natural order; switch to popular order"
                                            }
                                            onClick={() =>
                                                setSorts((previous) => ({
                                                    ...previous,
                                                    [chart.field]: !isPopular(chart.field),
                                                }))
                                            }
                                        >
                                            <Show
                                                when={isPopular(chart.field)}
                                                fallback={
                                                    <ListOrdered size={16} aria-hidden="true" />
                                                }
                                            >
                                                <ArrowDownWideNarrow size={16} aria-hidden="true" />
                                            </Show>
                                        </button>
                                        <span
                                            class="audience-response-count"
                                            title={`${chart.responses} of ${chart.total} respondents`}
                                            aria-label={`${chart.responses} of ${chart.total} respondents`}
                                        >
                                            {chart.responses} / {chart.total}
                                        </span>
                                    </div>
                                </header>
                                <Show
                                    when={chart.responses > 0}
                                    fallback={<Empty title="No responses" />}
                                >
                                    <For
                                        each={(isPopular(chart.field)
                                            ? rankAnswers(chart.groups)
                                            : chart.groups
                                        ).filter((group) => isShowingEmpty() || group.count > 0)}
                                    >
                                        {(group) => (
                                            <div class="audience-bar">
                                                <span>{group.label}</span>
                                                <span>
                                                    <strong>{group.count}</strong>{" "}
                                                    <span class="text-soft">
                                                        {group.percentage}%
                                                    </span>
                                                </span>
                                                <meter
                                                    min="0"
                                                    max={Math.max(chart.responses, 1)}
                                                    value={group.count}
                                                    aria-label={`${group.label}: ${group.count} of ${chart.responses} respondents (${group.percentage}%)`}
                                                />
                                            </div>
                                        )}
                                    </For>
                                </Show>
                            </section>
                        )}
                    </For>
                </div>
            </Show>
        </Card>
    );
}

/** Divide accounts into disjoint answer states on one shared scale. */
function SurveyParticipation(props: { total: number; respondents: number; complete: number }) {
    const segments = () => [
        { label: "All answered", count: props.complete, color: "var(--color-brand)" },
        { label: "Some answered", count: props.respondents - props.complete, color: "#6b94d4" },
        { label: "Unanswered", count: props.total - props.respondents, color: "#c8cbd0" },
    ];

    return (
        <div class="audience-participation">
            <div
                class="audience-stack"
                role="img"
                aria-label={segments()
                    .map((segment) => `${segment.label}: ${segment.count}`)
                    .join(", ")}
            >
                <For each={segments().filter((segment) => segment.count > 0)}>
                    {(segment) => (
                        <span style={{ "flex-grow": segment.count, background: segment.color }} />
                    )}
                </For>
            </div>
            <ul class="audience-stack-legend">
                <For each={segments()}>
                    {(segment) => (
                        <li>
                            <i style={{ background: segment.color }} aria-hidden="true" />
                            <span>{segment.label}</span>
                            <strong>{segment.count}</strong>
                        </li>
                    )}
                </For>
            </ul>
        </div>
    );
}
