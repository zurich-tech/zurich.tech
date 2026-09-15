import { locationsLabel } from "./format";
import { Highlight } from "../components/highlight";
import { Image } from "../components/image";
import { type Job } from "./queries";
import { Show } from "solid-js";

import { JobTags } from "./tags";
import { salaryLabel } from "./format";
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
                        text={`${props.job.company.name} · ${locationsLabel(props.job.locations) || "Remote"}`}
                        terms={props.terms ?? []}
                    />
                </p>
                <Show when={!props.isCompact}>
                    <p>{props.job.summary}</p>
                </Show>
                <Show when={!props.isCompact && props.job.compensation?.salary}>
                    <p class="job-salary">{salaryLabel(props.job.compensation?.salary!)}</p>
                </Show>
                <Show when={!props.isCompact}>
                    <JobTags job={props.job} />
                </Show>
            </div>
            <Arrow />
        </a>
    );
}
