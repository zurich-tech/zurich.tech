import {
    createSignal,
    createUniqueId,
    createEffect,
    createMemo,
    For,
    Show,
    onCleanup,
} from "solid-js";
import { ArrowDownWideNarrow, ListOrdered, ChevronDown, ChevronUp } from "lucide-solid";
import { rankAnswers } from "./audience";
import type { PercentageGroup } from "../../convex/members/results";
import { surveyLabels, surveyTitles, type SurveyQuestion } from "../../convex/members/demographics";
import { Empty } from "../components/empty";
import { FilterSelect } from "../components/filter-select";
import "../topics/topics.css";
import "./review.css";

/** Filter aggregate questions and control their count display across results pages. */
export function AudienceCharts(props: {
    questions: Omit<Parameters<typeof AudienceChart>[0], "total">[];
    total: number;
}) {
    const [question, setQuestion] = createSignal("");
    const [isShowingEmpty, setShowingEmpty] = createSignal(false);
    const [isHidingCounts, setHidingCounts] = createSignal(false);

    return (
        <>
            <div class="audience-toolbar">
                <FilterSelect
                    label="Survey question"
                    value={question()}
                    onChange={setQuestion}
                    options={[
                        { value: "", label: "All questions" },
                        ...props.questions.map((chart) => ({
                            value: chart.field,
                            label: surveyTitles[chart.field as SurveyQuestion] ?? chart.label,
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
                <label class="checkbox">
                    <input
                        type="checkbox"
                        checked={isHidingCounts()}
                        onChange={(event) => setHidingCounts(event.currentTarget.checked)}
                    />
                    Hide absolute counts
                </label>
            </div>
            <div class="audience-charts">
                <For
                    each={props.questions.filter(
                        (chart) => !question() || chart.field === question(),
                    )}
                >
                    {(chart) => (
                        <AudienceChart
                            {...chart}
                            total={props.total}
                            showEmpty={isShowingEmpty()}
                            hideCounts={isHidingCounts()}
                        />
                    )}
                </For>
            </div>
        </>
    );
}

/** Render one aggregate question consistently in admin and event reports. */
export function AudienceChart(props: {
    field: string;
    label: string;
    responses?: number;
    total?: number;
    groups: (
        | PercentageGroup
        | {
              label: string;
              count: number;
              percentage: number;
              reviewed: number;
              inferred: number;
              unreviewed: number;
          }
    )[];
    showEmpty?: boolean;
    hideCounts?: boolean;
    /** Limit a compact overview to its leading responses. */
    limit?: number;
    /** Allow a shortened distribution to reveal every answer. */
    expandable?: boolean;
    /** Retain full question wording in detailed reports. */
    showQuestion?: boolean;
}) {
    const label = () => surveyTitles[props.field as SurveyQuestion] ?? props.label;
    const question = () => surveyLabels[props.field as SurveyQuestion];
    const [isExpanded, setExpanded] = createSignal(false);
    const [isPopular, setPopular] = createSignal(
        !["eventsAttended", "eventFrequency", "experience", "education", "age"].includes(
            props.field,
        ),
    );
    const groups = createMemo(() =>
        (isPopular() ? rankAnswers(props.groups) : props.groups).filter(
            (group) => props.showEmpty || ("count" in group ? group.count > 0 : group.hasResponses),
        ),
    );

    return (
        <section>
            <header class="audience-question-heading">
                <h3>{label()}</h3>
                <div class="audience-question-actions">
                    <Show when={props.limit === undefined || props.expandable}>
                        <button
                            type="button"
                            class="audience-sort"
                            aria-label={`Sort ${label()} by ${isPopular() ? "natural order" : "popularity"}`}
                            aria-pressed={isPopular()}
                            title={
                                isPopular()
                                    ? "Popular order; switch to natural order"
                                    : "Natural order; switch to popular order"
                            }
                            onClick={() => setPopular(!isPopular())}
                        >
                            <Show when={isPopular()} fallback={<ListOrdered size={16} />}>
                                <ArrowDownWideNarrow size={16} />
                            </Show>
                        </button>
                    </Show>
                    <Show when={!props.hideCounts}>
                        <span
                            class="audience-response-count"
                            title={`${props.responses} of ${props.total} answered${props.groups.some((group) => "inferred" in group && group.inferred) ? "; historical option coverage is estimated" : ""}`}
                        >
                            {props.responses} / {props.total}
                        </span>
                    </Show>
                </div>
            </header>
            <Show when={(props.showQuestion ?? props.limit === undefined) && question()}>
                <p class="audience-question-wording">{question()}</p>
            </Show>
            <Show
                when={groups().some((group) =>
                    "count" in group ? group.count > 0 : group.hasResponses,
                )}
                fallback={<Empty title="No responses" />}
            >
                <For
                    each={
                        props.limit === undefined || isExpanded()
                            ? groups()
                            : groups().slice(0, props.limit)
                    }
                >
                    {(group) => (
                        <div class="audience-bar">
                            <span>{group.label}</span>
                            <span>
                                <Show when={!props.hideCounts}>
                                    <strong>
                                        {"count" in group ? group.count : undefined}
                                    </strong>{" "}
                                </Show>
                                <Show
                                    when={
                                        "unreviewed" in group
                                            ? group.unreviewed > 0
                                            : group.hasUnreviewed
                                    }
                                    fallback={<span class="text-soft">{group.percentage}%</span>}
                                >
                                    <Coverage group={group} hideCounts={props.hideCounts} />
                                </Show>
                            </span>
                            <meter
                                min={0}
                                max={100}
                                value={group.percentage}
                                aria-label={
                                    props.hideCounts || !("count" in group)
                                        ? `${group.label}: ${group.percentage}%`
                                        : `${group.label}: ${group.count} of ${group.reviewed} with this choice available; ${group.unreviewed} unreviewed`
                                }
                            />
                        </div>
                    )}
                </For>
            </Show>
            <Show
                when={
                    props.expandable && props.limit !== undefined && groups().length > props.limit
                }
            >
                <button
                    type="button"
                    class="action-link audience-answer-expand"
                    aria-expanded={isExpanded()}
                    onClick={() => setExpanded(!isExpanded())}
                >
                    {isExpanded() ? "Show fewer" : `Show all ${groups().length}`}
                    <Show when={isExpanded()} fallback={<ChevronDown size={14} />}>
                        <ChevronUp size={14} />
                    </Show>
                </button>
            </Show>
        </section>
    );
}

/** Explain a changed denominator on hover, focus, or touch. */
function Coverage(props: {
    hideCounts?: boolean;
    group:
        | PercentageGroup
        | {
              label: string;
              count: number;
              reviewed: number;
              unreviewed: number;
              inferred: number;
              percentage: number;
          };
}) {
    const [isOpen, setOpen] = createSignal(false);
    const id = createUniqueId();
    let element!: HTMLSpanElement;

    // dismiss touch disclosures when another target is pressed
    createEffect(() => {
        if (!isOpen()) return;

        const dismiss = (event: PointerEvent) => {
            if (!element.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener("pointerdown", dismiss);
        onCleanup(() => document.removeEventListener("pointerdown", dismiss));
    });

    return (
        <span
            ref={element}
            class="survey-coverage"
            onPointerEnter={(event) => {
                if (event.pointerType !== "touch") setOpen(true);
            }}
            onPointerLeave={() => setOpen(false)}
            onFocusIn={() => setOpen(true)}
            onFocusOut={() => setOpen(false)}
            onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
            }}
        >
            <button
                type="button"
                aria-label={`Response coverage for ${props.group.label}`}
                aria-describedby={isOpen() ? id : undefined}
                onClick={() => setOpen(true)}
            >
                {!("reviewed" in props.group) || props.group.reviewed
                    ? `${props.group.percentage}%`
                    : "—"}
            </button>
            <Show when={isOpen()}>
                <span id={id} role="tooltip" class="survey-coverage-tooltip">
                    <Show
                        when={!props.hideCounts && "count" in props.group ? props.group : undefined}
                        fallback={<span>Among respondents with this choice available</span>}
                    >
                        {(group) => (
                            <>
                                <span>
                                    <strong>
                                        {group().count} of {group().reviewed}
                                    </strong>{" "}
                                    selected
                                </span>
                                <span>{group().unreviewed} not reviewed</span>
                            </>
                        )}
                    </Show>
                    <Show
                        when={
                            "inferred" in props.group
                                ? props.group.inferred > 0
                                : props.group.isEstimated
                        }
                    >
                        <small>Estimated</small>
                    </Show>
                </span>
            </Show>
        </span>
    );
}
