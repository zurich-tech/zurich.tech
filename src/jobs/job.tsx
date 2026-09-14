import { Highlight } from "../components/highlight";
import { Image } from "../components/image";
import { type Job } from "./queries";
import { Show, For } from "solid-js";

import { workplaces, employments } from "./filters";
import { Arrow } from "../components/arrow";

/** Render a vacancy using the same title, tags and rule rhythm as event entries. */
export function JobEntry(props: {
    job: Job;
    terms?: readonly string[];
    /** Use a short row for the homepage sidebar. */ isCompact?: boolean;
}) {
    return (
        <a
            class="job-entry"
            classList={{ "job-entry--compact": props.isCompact }}
            href={`/jobs/${props.job.slug}`}
        >
            <div class="company-logo">
                <Show
                    when={props.job.company.logoUrl}
                    fallback={props.job.company.name.slice(0, 2)}
                >
                    <Image
                        src={props.job.company.logoUrl}
                        darkSrc={props.job.company.logoDarkUrl}
                        alt=""
                        loading="lazy"
                    />
                </Show>
            </div>
            <div class="job-copy">
                <strong>
                    <Highlight text={props.job.title} terms={props.terms ?? []} />
                </strong>
                <p>
                    <Highlight
                        text={`${props.job.company.name} · ${props.job.location}`}
                        terms={props.terms ?? []}
                    />
                </p>
                <Show when={!props.isCompact && props.job.salary}>
                    <p class="job-salary">{salaryLabel(props.job.salary!)}</p>
                </Show>
                <Show when={!props.isCompact}>
                    <div class="tags">
                        <span class="tag">{workplaces[props.job.workplace]}</span>
                        <span class="tag">{employments[props.job.employment]}</span>
                        <For each={props.job.tags}>{(tag) => <span class="tag">{tag}</span>}</For>
                    </div>
                </Show>
            </div>
            <Arrow />
        </a>
    );
}

/** Format the declared compensation range without implying missing salary information. */
export function salaryLabel(salary: NonNullable<Job["salary"]>): string {
    const amount = new Intl.NumberFormat("de-CH");

    return `CHF ${amount.format(salary.min)}–${amount.format(salary.max)} / ${salary.period}`;
}
