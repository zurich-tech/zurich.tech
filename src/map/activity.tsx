import { ArrowRight, BriefcaseBusiness, Newspaper } from "lucide-solid";
import { For, Show } from "solid-js";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { locationsLabel } from "../jobs/format";
import { workplaces } from "../jobs/filters";

/** Public activity for one organisation, without article bodies or application details. */
export type OrganisationActivity = FunctionReturnType<typeof api.places.map.activity>[number];

/** Present the same two recent stories and open roles in map previews and details. */
export function MapActivity(props: { activity: OrganisationActivity }) {
    const newsHref = () => `/news?organisation=${encodeURIComponent(props.activity.slug)}`;
    const jobsHref = () => `/jobs?company=${encodeURIComponent(props.activity.slug)}`;

    return (
        <Show when={props.activity.newsCount || props.activity.jobCount}>
            <div class="map-activity">
                <Show when={props.activity.newsCount}>
                    <section aria-label="Recent news">
                        <a class="map-activity__heading" href={newsHref()}>
                            <Newspaper size={14} aria-hidden="true" />
                            <span>News</span>
                            <span class="map-activity__count">{props.activity.newsCount}</span>
                            <ArrowRight size={14} aria-hidden="true" />
                        </a>
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
                        <a class="map-activity__heading" href={jobsHref()}>
                            <BriefcaseBusiness size={14} aria-hidden="true" />
                            <span>Open jobs</span>
                            <span class="map-activity__count">{props.activity.jobCount}</span>
                            <ArrowRight size={14} aria-hidden="true" />
                        </a>
                        <For each={props.activity.jobs}>
                            {(job) => (
                                <a class="map-activity__job" href={job.path}>
                                    <span class="map-activity__copy">
                                        <strong>{job.title}</strong>
                                        <span class="map-activity__meta">
                                            {[
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
