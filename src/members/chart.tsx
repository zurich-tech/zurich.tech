import { createSignal, For, Show } from "solid-js";
import { ArrowDownWideNarrow, ListOrdered } from "lucide-solid";
import { rankAnswers } from "./audience";
import { Empty } from "../components/empty";
import "../topics/topics.css";
import "./review.css";

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
                    <span
                        class="audience-response-count"
                        title={`${props.responses} of ${props.total} answered${props.groups.some((group) => group.inferred) ? "; historical option coverage is estimated" : ""}`}
                    >
                        {props.responses} / {props.total}
                    </span>
                </div>
            </header>
            <Show when={props.responses > 0} fallback={<Empty title="No responses" />}>
                <For each={groups()}>
                    {(group) => (
                        <div class="audience-bar">
                            <span>{group.label}</span>
                            <span>
                                <strong>{group.count}</strong>{" "}
                                <Show
                                    when={group.unreviewed > 0}
                                    fallback={<span class="text-soft">{group.percentage}%</span>}
                                >
                                    <details class="survey-coverage">
                                        <summary
                                            aria-label={`Response coverage for ${group.label}`}
                                        >
                                            {group.reviewed ? `${group.percentage}%` : "—"}
                                        </summary>
                                        <p>
                                            {group.count} / {group.reviewed} selected
                                            <br />
                                            {group.unreviewed} haven't reviewed
                                            <Show when={group.inferred > 0}>
                                                <br />
                                                <small>Historical coverage estimated.</small>
                                            </Show>
                                        </p>
                                    </details>
                                </Show>
                            </span>
                            <meter
                                min={0}
                                max={100}
                                value={group.percentage}
                                aria-label={`${group.label}: ${group.count} of ${group.reviewed} with this choice available; ${group.unreviewed} unreviewed`}
                            />
                        </div>
                    )}
                </For>
            </Show>
        </section>
    );
}
