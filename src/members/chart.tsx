import { createSignal, createUniqueId, createEffect, For, Show, onCleanup } from "solid-js";
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
                                    <Coverage group={group} />
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

/** Explain a changed denominator on hover, focus, or touch. */
function Coverage(props: {
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
                    <span>
                        <strong>
                            {props.group.count} of {props.group.reviewed}
                        </strong>{" "}
                        selected
                    </span>
                    <span>{props.group.unreviewed} not reviewed</span>
                    <Show when={props.group.inferred > 0}>
                        <small>Estimated</small>
                    </Show>
                </span>
            </Show>
        </span>
    );
}
