import { For, Show } from "solid-js";
import type { Job } from "./queries";
import { getTopics } from "../topics/queries";
import { jobFacts } from "../../convex/jobs/format";

/** Render consistent workplace, engagement and discovery tags across job surfaces. */
export function JobTags(props: { job: Job; isCompact?: boolean }) {
    const topics = getTopics.use(() => []);
    return (
        <div class="tags">
            <For each={jobFacts(props.job)}>
                {(label) => <span class="tag tag-emphasis">{label}</span>}
            </For>
            <Show when={!props.isCompact}>
                <For each={props.job.topics}>
                    {(slug) => (
                        <span class="tag">
                            {topics()?.find((topic) => topic.slug === slug)?.name ?? slug}
                        </span>
                    )}
                </For>
                <For each={props.job.skills}>{(skill) => <span class="tag">{skill}</span>}</For>
            </Show>
        </div>
    );
}
