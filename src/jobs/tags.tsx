import { For, Show } from "solid-js";
import type { Job } from "./queries";
import { getTopics } from "../topics/queries";
import { workplaces, engagements } from "./filters";
import { rangeLabel } from "./format";

/** Render consistent workplace, engagement and discovery tags across job surfaces. */
export function JobTags(props: { job: Job }) {
    const topics = getTopics.use(() => []);
    return (
        <div class="tags">
            <span class="tag">{workplaces[props.job.workplace]}</span>
            <span class="tag">{engagements[props.job.engagement]}</span>
            <Show when={props.job.workload}>
                <span class="tag">{rangeLabel(props.job.workload!)}%</span>
            </Show>
            <For each={props.job.topics}>
                {(slug) => (
                    <span class="tag">
                        {topics()?.find((topic) => topic.slug === slug)?.name ?? slug}
                    </span>
                )}
            </For>
            <For each={props.job.skills}>{(skill) => <span class="tag">{skill}</span>}</For>
        </div>
    );
}
