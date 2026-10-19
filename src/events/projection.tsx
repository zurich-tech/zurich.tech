import { createResource, For, Show, onMount, onCleanup } from "solid-js";
import { A, useParams, useSearchParams } from "@solidjs/router";
import qrcode from "qrcode-generator";
import { useAccount } from "../auth";
import { useAccess } from "../auth/edit";
import { Arrow } from "../components/arrow";
import { errorMessage } from "../components/errors";
import { memberClient, publicClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import { surveyLabels, surveyQuestions } from "../../convex/members/demographics";
import { Seo } from "../app/seo";
import { Kitten, kittenMood, kittenMoods } from "./kitten";
import "./projection.css";

/** Project public completion counts and administrator-only aggregate survey results. */
export function Projection() {
    const params = useParams<{ slug: string }>();
    const account = useAccount();
    const access = useAccess();
    const [search] = useSearchParams();
    const isResults = () => search.view === "results";
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
            <Seo title="Event survey" description="Get to know the room." noIndex />
            <ProjectionHeader
                eventHref={`/events/${params.slug}`}
                basePath={`/events/${params.slug}/survey`}
                isResults={isResults()}
                canResults={!!access.current()?.isAdmin}
            />
            <Show
                when={!isResults() || account.user()}
                fallback={
                    <p>
                        <a
                            href={`/sign-in?next=${encodeURIComponent(`/events/${params.slug}/survey${isResults() ? "?view=results" : ""}`)}`}
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
                                    role={isResults() && access.access.error ? "alert" : "status"}
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
        </div>
    );
}

/** Navigate between an event, public progress and administrator-only results. */
export function ProjectionHeader(props: {
    eventHref: string;
    basePath: string;
    isResults: boolean;
    canResults: boolean;
}) {
    return (
        <header class="projection-header">
            <A class="eyebrow" href={props.eventHref}>
                <Arrow direction="left" /> Event
            </A>
            <Show when={props.canResults || props.isResults}>
                <nav class="projection-tabs" aria-label="Survey view">
                    <a href={props.basePath} aria-current={!props.isResults ? "page" : undefined}>
                        Survey
                    </a>
                    <Show when={props.canResults}>
                        <a
                            href={`${props.basePath}?view=results`}
                            aria-current={props.isResults ? "page" : undefined}
                        >
                            Results
                        </a>
                    </Show>
                </nav>
            </Show>
        </header>
    );
}

/** Present anonymous responses from the event's registered attendees. */
export function SurveyResults(props: {
    registered: number;
    questions: { label: string; responses: number; groups: { label: string; count: number }[] }[];
}) {
    return (
        <section class="projection-results" aria-label="Survey results">
            <header class="projection-intro">
                <h1>Meet the room</h1>
                <p>
                    {props.registered} registered attendees · {surveyQuestions.length} questions
                </p>
            </header>
            <div class="projection-questions">
                <For each={surveyQuestions}>
                    {(field) => {
                        const question = () =>
                            props.questions.find((value) => value.label === surveyLabels[field]);

                        return (
                            <section>
                                <header class="projection-question-heading">
                                    <h2>{surveyLabels[field]}</h2>
                                    <Show when={question()}>
                                        {(value) => (
                                            <span>
                                                {value().responses} / {props.registered} answered
                                            </span>
                                        )}
                                    </Show>
                                </header>
                                <Show when={question()}>
                                    {(value) => (
                                        <For
                                            each={[...value().groups].sort(
                                                (left, right) => right.count - left.count,
                                            )}
                                        >
                                            {(group) => (
                                                <div class="projection-answer">
                                                    <span>{group.label}</span>
                                                    <strong>
                                                        {group.count}{" "}
                                                        <small>
                                                            {Math.round(
                                                                (group.count / value().responses) *
                                                                    100,
                                                            )}
                                                            %
                                                        </small>
                                                    </strong>
                                                    <div
                                                        class="projection-answer-bar"
                                                        role="meter"
                                                        aria-label={group.label}
                                                        aria-valuemin={0}
                                                        aria-valuemax={value().responses}
                                                        aria-valuenow={group.count}
                                                    >
                                                        <span
                                                            style={{
                                                                width: `${(group.count / value().responses) * 100}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    )}
                                </Show>
                            </section>
                        );
                    }}
                </For>
            </div>
        </section>
    );
}

/** Render the projector artwork and participation instructions. */
export function SurveyStage(props: { completed: number; registered: number }) {
    const progress = () => (props.registered ? (props.completed / props.registered) * 100 : 0);
    const mood = () => kittenMood(progress());
    const code = qrcode(0, "H");
    code.addData("https://zurich.tech/survey");
    code.make();
    // preserve square modules and a four-module quiet zone around the branded code
    const modules = code.getModuleCount();
    const qr = Array.from({ length: modules * modules }, (_, index) => {
        const row = Math.floor(index / modules);
        const column = index % modules;

        return code.isDark(row, column) ? `M${column} ${row}h1v1h-1z` : "";
    }).join("");

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
                    <svg
                        viewBox={`-4 -4 ${modules + 8} ${modules + 8}`}
                        role="img"
                        aria-label="Scan to open zurich.tech/survey"
                    >
                        <path d={qr} fill="currentColor" />
                        <rect
                            x={modules / 2 - 3.5}
                            y={modules / 2 - 3.5}
                            width="7"
                            height="7"
                            rx="1"
                            fill="var(--color-paper)"
                        />
                        <image
                            href="/branding/logo.svg"
                            x={modules / 2 - 2.5}
                            y={modules / 2 - 2.5}
                            width="5"
                            height="5"
                        />
                    </svg>
                </figure>
                <ol class="projection-steps">
                    <li>
                        <span>
                            Go to <a href="/survey">zurich.tech/survey</a>.
                        </span>
                    </li>
                    <li>Sign in with your registration email.</li>
                    <li>Complete the survey.</li>
                </ol>
            </section>
        </div>
    );
}
