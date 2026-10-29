import { createResource, createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { QrCode } from "../components/qr";
import { A, useParams } from "@solidjs/router";
import { useAccount } from "../auth";
import { useAccess } from "../auth/edit";
import { Arrow } from "../components/arrow";
import { errorMessage } from "../components/errors";
import { memberClient, publicClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import { surveyQuestions } from "../../convex/members/demographics";
import { AudienceCharts } from "../members/chart";
import { Seo } from "../app/seo";
import { Kitten, kittenMood, kittenMoods } from "./kitten";
import { Overview } from "./overview";
import { Maximize } from "lucide-solid";
import "./projection.css";

/** Project public completion counts and administrator-only aggregate survey results. */
export function Projection(props: { view: "overview" | "survey" | "results" }) {
    const params = useParams<{ slug: string }>();
    const account = useAccount();
    const access = useAccess();
    const isResults = () => props.view === "results";
    const isOverview = () => props.view === "overview";
    const basePath = () => `/events/${params.slug}`;
    const canRead = () => !isResults() || (!!account.user() && !!access.current()?.isAdmin);
    const [report, { refetch }] = createResource(
        () =>
            canRead()
                ? {
                      slug: params.slug,
                      results: isResults(),
                      account: isResults() ? account.user()!.id : null,
                  }
                : undefined,
        async (request) => ({
            ...request,
            value: await (request.results ? await memberClient() : publicClient()).query(
                api.events.survey.report,
                { slug: request.slug, results: request.results },
            ),
        }),
    );

    // show private responses only for the account, event and view that requested them
    const currentReport = () => {
        const value = report.error ? undefined : report.latest;

        return value &&
            (!value.results || value.account === account.user()?.id) &&
            value.slug === params.slug &&
            value.results === isResults()
            ? value.value
            : undefined;
    };

    // refresh at most once every ten seconds and never overlap requests
    onMount(() => {
        const timer = setInterval(() => {
            if (canRead() && !report.loading && !document.hidden) void refetch();
        }, 10_000);
        onCleanup(() => clearInterval(timer));
    });

    return (
        <div class="event-projection">
            <Seo title="Event presentation" description="Get to know the room." noIndex />
            <ProjectionHeader
                eventHref={`/events/${params.slug}`}
                basePath={basePath()}
                isOverview={isOverview()}
                isResults={isResults()}
                canResults={!!access.current()?.isAdmin}
            />
            <Show
                when={!isOverview()}
                fallback={
                    <Overview
                        slug={params.slug}
                        progress={currentReport()}
                        progressError={report.error}
                    />
                }
            >
                <Show
                    when={!isResults() || account.user()}
                    fallback={
                        <p>
                            <a
                                href={`/sign-in?next=${encodeURIComponent(`${basePath()}/results`)}`}
                            >
                                Sign in
                            </a>{" "}
                            with an administrator account to view survey results.
                        </p>
                    }
                >
                    <Show
                        when={!isResults() || access.current()?.isAdmin}
                        fallback={
                            <p class="projection-notice">
                                Admin access is required to view survey results.
                            </p>
                        }
                    >
                        <Show
                            when={!report.error}
                            fallback={
                                <p class="projection-notice" role="alert">
                                    {errorMessage(report.error, "Could not load the survey.")}
                                </p>
                            }
                        >
                            <Show
                                when={currentReport()}
                                fallback={
                                    <p
                                        class="projection-notice"
                                        role={
                                            isResults() && access.access.error ? "alert" : "status"
                                        }
                                    >
                                        {isResults() && access.access.error
                                            ? errorMessage(
                                                  access.access.error,
                                                  "Could not verify your event access.",
                                              )
                                            : "Loading survey…"}
                                    </p>
                                }
                            >
                                <Show
                                    when={!isResults()}
                                    fallback={
                                        <Show when={currentReport()?.questions}>
                                            {(questions) => (
                                                <SurveyResults
                                                    registered={currentReport()!.registered}
                                                    questions={questions()}
                                                />
                                            )}
                                        </Show>
                                    }
                                >
                                    <SurveyStage
                                        completed={currentReport()!.completed}
                                        registered={currentReport()!.registered}
                                    />
                                </Show>
                            </Show>
                        </Show>
                    </Show>
                </Show>
            </Show>
        </div>
    );
}

/** Navigate between an event, public progress and administrator-only results. */
export function ProjectionHeader(props: {
    eventHref: string;
    basePath: string;
    isResults: boolean;
    canResults: boolean;
    isOverview?: boolean;
}) {
    const [error, setError] = createSignal<string>();

    return (
        <header class="projection-header">
            <A class="projection-back" href={props.eventHref}>
                <Arrow direction="left" /> Event
            </A>
            <nav class="projection-tabs" aria-label="Presentation view">
                <A
                    href={`${props.basePath}/overview`}
                    aria-current={props.isOverview ? "page" : undefined}
                >
                    Overview
                </A>
                <A
                    href={`${props.basePath}/survey`}
                    aria-current={!props.isResults && !props.isOverview ? "page" : undefined}
                >
                    Survey
                </A>
                <Show when={props.canResults}>
                    <A
                        href={`${props.basePath}/results`}
                        aria-current={props.isResults ? "page" : undefined}
                    >
                        Results
                    </A>
                </Show>
            </nav>
            <button
                class="projection-fullscreen"
                title="Toggle fullscreen"
                aria-label="Toggle fullscreen"
                onClick={async (event) => {
                    const root = event.currentTarget.closest(".event-projection");
                    setError(undefined);
                    try {
                        if (document.fullscreenElement) await document.exitFullscreen();
                        else if (root) await root.requestFullscreen();
                    } catch {
                        setError(
                            "The browser blocked fullscreen. Use its fullscreen menu instead.",
                        );
                    }
                }}
            >
                <Maximize size={18} />
            </button>
            <Show when={error()}>
                <p role="alert">{error()}</p>
            </Show>
        </header>
    );
}

/** Present anonymous responses from the event's registered attendees. */
export function SurveyResults(props: {
    registered: number;
    questions: {
        field: string;
        label: string;
        responses: number;
        groups: {
            label: string;
            count: number;
            percentage: number;
            reviewed: number;
            inferred: number;
            unreviewed: number;
        }[];
    }[];
}) {
    return (
        <section class="projection-results" aria-label="Survey results">
            <header class="projection-intro">
                <h1>Meet the room</h1>
                <p>
                    {props.registered} registered attendees · {surveyQuestions.length} questions
                </p>
            </header>
            <AudienceCharts questions={props.questions} total={props.registered} />
        </section>
    );
}

/** Render the projector artwork and participation instructions. */
export function SurveyStage(props: { completed: number; registered: number }) {
    const progress = () => (props.registered ? (props.completed / props.registered) * 100 : 0);
    const mood = () => kittenMood(progress());

    return (
        <div class={`projection-stage projection-stage--${mood()}`}>
            <header class="projection-intro">
                <h1>
                    <span>This kitten is</span> <em>{mood().toUpperCase()}.</em>
                </h1>
            </header>
            <section class="projection-mascot" aria-label="Survey completion">
                <p
                    class="projection-total"
                    aria-label={`${props.completed} of ${props.registered} registered attendees completed the survey`}
                >
                    <span>
                        {props.completed} / {props.registered} completed
                    </span>
                    <strong>
                        {Math.round(progress())}
                        <small>%</small>
                    </strong>
                </p>
                <div
                    class="projection-dial"
                    role="meter"
                    aria-label="Registered attendees who finished the survey"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress())}
                >
                    <svg viewBox="0 40 560 460" aria-hidden="true">
                        <For each={kittenMoods}>
                            {(value, index) => (
                                <path
                                    d="M40 330 A240 240 0 0 1 520 330"
                                    pathLength="100"
                                    stroke-dasharray="19 101"
                                    stroke-dashoffset={-index() * 20}
                                    class={`dial-zone dial-zone--${value}`}
                                />
                            )}
                        </For>
                        <g class="dial-ticks">
                            <For each={Array.from({ length: 21 }, (_, index) => index)}>
                                {(index) => (
                                    <path
                                        d={index % 4 === 0 ? "M16 330 H28" : "M20 330 H28"}
                                        transform={`rotate(${index * 9} 280 330)`}
                                    />
                                )}
                            </For>
                        </g>
                        <g
                            class="dial-pointer"
                            style={{ transform: `rotate(${progress() * 1.8}deg)` }}
                        >
                            <circle
                                cx="40"
                                cy="330"
                                r="17"
                                fill="var(--color-ink)"
                                stroke="var(--color-paper)"
                                stroke-width="5"
                            />
                        </g>
                        <g class="dial-labels">
                            <text x="40" y="370">
                                0%
                            </text>
                            <For each={[20, 40, 60, 80]}>
                                {(value) => (
                                    <text
                                        x={280 - 280 * Math.cos((value / 100) * Math.PI)}
                                        y={338 - 280 * Math.sin((value / 100) * Math.PI)}
                                    >
                                        {value}%
                                    </text>
                                )}
                            </For>
                            <text x="520" y="370">
                                100%
                            </text>
                        </g>
                    </svg>
                    <Kitten mood={mood()} />
                </div>
            </section>
            <section class="projection-instructions" aria-label="How to help">
                <figure class="projection-scan">
                    <QrCode
                        url="https://zurich.tech/survey"
                        label="Scan to open zurich.tech/survey"
                    />
                </figure>
                <ol class="projection-steps">
                    <li>
                        <span>
                            Go to <a href="/survey">zurich.tech/survey</a>.
                        </span>
                    </li>
                    <li>Sign in with your registration email.</li>
                    <li aria-describedby="survey-update-note">
                        <span>
                            Complete the survey.<sup aria-hidden="true">*</sup>
                        </span>
                    </li>
                </ol>
                <p class="projection-footnote" id="survey-update-note">
                    * Already answered? Check for new questions and choices.
                </p>
            </section>
        </div>
    );
}
