import { locationsLabel } from "./format";
import { Highlight } from "../components/highlight";
import { Image } from "../components/image";
import { type Job } from "./queries";
import { Show } from "solid-js";

import { JobTags } from "./tags";
import { Arrow } from "../components/arrow";
import "./jobs.css";

/** Render a vacancy using the same title, tags and rule rhythm as event entries. */
export function JobEntry(props: {
    job: Job;
    terms?: readonly string[];
    /** Use a short row for the homepage sidebar. */ isCompact?: boolean;
}) {
    return (
        <article class="job-entry" classList={{ "job-entry--compact": props.isCompact }}>
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
                <a class="job-title" href={`/jobs/${props.job.slug}`}>
                    <Highlight text={props.job.title} terms={props.terms ?? []} />
                </a>
                <p>
                    <a
                        class="job-company"
                        href={`/jobs?company=${encodeURIComponent(props.job.company.slug)}`}
                        title={`Show jobs at ${props.job.company.name}`}
                    >
                        <Highlight text={props.job.company.name} terms={props.terms ?? []} />
                    </a>
                    {" · "}
                    <Highlight
                        text={locationsLabel(props.job.locations) || "Remote"}
                        terms={props.terms ?? []}
                    />
                </p>
                <Show when={!props.isCompact}>
                    <p>{props.job.summary}</p>
                </Show>
                <JobTags job={props.job} isCompact={props.isCompact} />
            </div>
            <Arrow />
        </article>
    );
}
