import { createSignal, createUniqueId, createEffect, For, Show, onCleanup } from "solid-js";
import { ArrowDownWideNarrow, ListOrdered } from "lucide-solid";
import { rankAnswers } from "./audience";
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
    responses: number;
    total: number;
    groups: {
        label: string;
        count: number;
        percentage: number;
        reviewed: number;
        inferred: number;
        unreviewed: number;
    }[];
    showEmpty?: boolean;
    hideCounts?: boolean;
}) {
    const [isPopular, setPopular] = createSignal(
        !["eventsAttended", "eventFrequency", "experience", "education", "age"].includes(
            props.field,
        ),
    );
    const groups = () =>
        (isPopular() ? rankAnswers(props.groups) : props.groups).filter(
            (group) => props.showEmpty || group.count > 0,
        );

    return (
        <section>
            <header class="audience-question-heading">
                <h3>{props.label}</h3>
                <div class="audience-question-actions">
                    <button
                        type="button"
                        class="audience-sort"
                        aria-label={`Sort ${props.label} by ${isPopular() ? "natural order" : "popularity"}`}
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
                    <Show when={!props.hideCounts}>
                        <span
                            class="audience-response-count"
                            title={`${props.responses} of ${props.total} answered${props.groups.some((group) => group.inferred) ? "; historical option coverage is estimated" : ""}`}
                        >
                            {props.responses} / {props.total}
                        </span>
                    </Show>
                </div>
            </header>
            <Show when={props.responses > 0} fallback={<Empty title="No responses" />}>
                <For each={groups()}>
                    {(group) => (
                        <div class="audience-bar">
                            <span>{group.label}</span>
                            <span>
                                <Show when={!props.hideCounts}>
                                    <strong>{group.count}</strong>{" "}
                                </Show>
                                <Show
                                    when={group.unreviewed > 0}
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
                                    props.hideCounts
                                        ? `${group.label}: ${group.percentage}%`
                                        : `${group.label}: ${group.count} of ${group.reviewed} with this choice available; ${group.unreviewed} unreviewed`
                                }
                            />
                        </div>
                    )}
                </For>
            </Show>
        </section>
    );
}

/** Explain a changed denominator on hover, focus, or touch. */
function Coverage(props: {
    hideCounts?: boolean;
    group: {
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
                {props.group.reviewed ? `${props.group.percentage}%` : "—"}
            </button>
            <Show when={isOpen()}>
                <span id={id} role="tooltip" class="survey-coverage-tooltip">
                    <Show
                        when={!props.hideCounts}
                        fallback={<span>Among respondents with this choice available</span>}
                    >
                        <span>
                            <strong>
                                {props.group.count} of {props.group.reviewed}
                            </strong>{" "}
                            selected
                        </span>
                        <span>{props.group.unreviewed} not reviewed</span>
                    </Show>
                    <Show when={props.group.inferred > 0}>
                        <small>Estimated</small>
                    </Show>
                </span>
            </Show>
        </span>
    );
}
