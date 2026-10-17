import { ArrowRight, BriefcaseBusiness, Newspaper } from "lucide-solid";
import { createEffect, createSignal, onCleanup, For, Show, type Accessor } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { publicClient } from "../auth/convex";
import { locationsLabel } from "../../convex/jobs/format";
import { workplaces } from "../../convex/jobs/labels";

/** Public activity for an organisation or address, without article bodies or application details. */
export type OrganisationActivity = FunctionReturnType<typeof api.places.map.activity>[number];

/** Load opened organisations, ignoring responses after selection changes or disposal. */
export function createActivity(
    slugs: Accessor<string[]>,
    combined: Accessor<boolean> = () => false,
) {
    const [activity, setActivity] = createSignal<OrganisationActivity[]>([]);
    const [error, setError] = createSignal(false);
    const [attempt, setAttempt] = createSignal(0);
    createEffect(() => {
        const selected = slugs();
        attempt();
        let isActive = true;
        setActivity([]);
        setError(false);
        void publicClient()
            .query(api.places.map.activity, { slugs: selected, combined: combined() })
            .then((result) => {
                if (isActive) setActivity(result);
            })
            .catch((cause: unknown) => {
                console.error("Could not load map news and jobs.", cause);
                if (isActive) setError(true);
            });
        onCleanup(() => {
            isActive = false;
        });
    });

    return { activity, error, retry: () => setAttempt((value) => value + 1) };
}

/** Present one combined news and jobs preview for a shared address. */
export function SharedActivity(props: { slugs: string[] }) {
    const { activity, error, retry } = createActivity(
        () => props.slugs,
        () => true,
    );

    return (
        <>
            <For each={activity()}>{(entry) => <MapActivity activity={entry} />}</For>
            <Show when={error()}>
                <p class="map-activity-error" role="status">
                    News and jobs couldn’t load.{" "}
                    <button type="button" onClick={retry}>
                        Retry
                    </button>
                </p>
            </Show>
        </>
    );
}

/** Present the same two recent stories and open roles in map previews and details. */
export function MapActivity(props: { activity: OrganisationActivity }) {
    const newsHref = () =>
        props.activity.slug === null
            ? undefined
            : `/news?organisation=${encodeURIComponent(props.activity.slug)}`;
    const jobsHref = () =>
        props.activity.slug === null
            ? undefined
            : `/jobs?company=${encodeURIComponent(props.activity.slug)}`;

    return (
        <Show when={props.activity.newsCount || props.activity.jobCount}>
            <div class="map-activity">
                <Show when={props.activity.newsCount}>
                    <section aria-label="Recent news">
                        <Dynamic
                            component={props.activity.slug ? "a" : "div"}
                            class="map-activity__heading"
                            href={newsHref()}
                        >
                            <Newspaper size={14} aria-hidden="true" />
                            <span>News</span>
                            <span class="map-activity__count">{props.activity.newsCount}</span>
                            <Show when={props.activity.slug}>
                                <ArrowRight size={14} aria-hidden="true" />
                            </Show>
                        </Dynamic>
                        <For each={props.activity.news}>
                            {(story) => (
                                <a class="map-activity__story" href={story.path}>
                                    <Show when={story.image}>
                                        <img
                                            src={story.image}
                                            alt=""
                                            loading="lazy"
                                            decoding="async"
                                        />
                                    </Show>
                                    <span class="map-activity__copy">
                                        <strong>{story.title}</strong>
                                        <Show when={story.organisation}>
                                            <span class="map-activity__meta">
                                                {story.organisation}
                                            </span>
                                        </Show>
                                        <time dateTime={new Date(story.date).toISOString()}>
                                            {new Date(story.date).toLocaleDateString("en-GB", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                                timeZone: "Europe/Zurich",
                                            })}
                                        </time>
                                    </span>
                                </a>
                            )}
                        </For>
                    </section>
                </Show>
                <Show when={props.activity.jobCount}>
                    <section aria-label="Open jobs">
                        <Dynamic
                            component={props.activity.slug ? "a" : "div"}
                            class="map-activity__heading"
                            href={jobsHref()}
                        >
                            <BriefcaseBusiness size={14} aria-hidden="true" />
                            <span>Open jobs</span>
                            <span class="map-activity__count">{props.activity.jobCount}</span>
                            <Show when={props.activity.slug}>
                                <ArrowRight size={14} aria-hidden="true" />
                            </Show>
                        </Dynamic>
                        <For each={props.activity.jobs}>
                            {(job) => (
                                <a class="map-activity__job" href={job.path}>
                                    <span class="map-activity__copy">
                                        <strong>{job.title}</strong>
                                        <span class="map-activity__meta">
                                            {[
                                                job.organisation,
                                                locationsLabel(job.locations),
                                                workplaces[job.workplace],
                                            ]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </span>
                                    </span>
                                    <ArrowRight size={14} aria-hidden="true" />
                                </a>
                            )}
                        </For>
                    </section>
                </Show>
            </div>
        </Show>
    );
}
