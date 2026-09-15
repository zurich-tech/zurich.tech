import { jobMetadata } from "../../../jobs/metadata";
import { EditLink } from "../../../auth/edit";
import { getJob } from "../../../jobs/queries";
import { useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { routeParam } from "../../params";
import { Page } from "../../page";
import { Seo } from "../../seo";
import { NotFound } from "../../notfound";
import { JobDetails } from "../../../jobs/details";

/** Begin the public request before rendering. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) => getJob(params.slug),
};

/** Read the approved vacancy and apply directly to the employer. */
export default function Route() {
    const params = useParams();
    const job = getJob.use(() => [routeParam("slug", params.slug)]);
    return (
        <Show when={job()} fallback={job() === null ? <NotFound /> : undefined}>
            {(item) => (
                <>
                    <Seo
                        title={`${item().title} · ${item().company.name}`}
                        description={item().summary}
                    />
                    <Show when={item().isOpen}>
                        <script
                            type="application/ld+json"
                            innerHTML={JSON.stringify(jobMetadata(item())).replaceAll(
                                "<",
                                "\\u003c",
                            )}
                        />
                    </Show>
                    <Page>
                        <div class="row-actions">
                            <a class="eyebrow" href="/jobs">
                                ← Jobs
                            </a>
                            <EditLink href={`/jobs/submit?edit=${item().id}`} />
                        </div>
                        <JobDetails job={item()} />
                    </Page>
                </>
            )}
        </Show>
    );
}
