import { getJob } from "../../core/queries";
import { createAsync, useParams } from "@solidjs/router";
import { Show, For } from "solid-js";
import { routeParam } from "../../core/route";

import { Card } from "../../component/card";
import { Page } from "../../component/page";
import { Seo } from "../../component/seo";
import { NotFound } from "../../component/notfound";
import { Markdown } from "../../component/markdown";
import { Arrow } from "../../component/arrow";
import { salaryLabel } from "../../component/job";
import { workplaces, employments } from "../../../shared/jobs";

/** Read a reviewed vacancy and apply directly with the employer. */
export default function Route() {
    const params = useParams();
    const job = createAsync(() => getJob(routeParam("slug", params.slug)), { deferStream: true });

    return (
        <Show when={job()} fallback={job() === null ? <NotFound /> : undefined}>
            {(item) => (
                <>
                    <Seo
                        title={`${item().title} · ${item().company.name}`}
                        description={`${item().title} at ${item().company.name}, ${item().location}. ${workplaces[item().workplace]}.`}
                    />
                    <Page>
                        <a class="eyebrow" href="/jobs">
                            <Arrow direction="left" /> Jobs
                        </a>
                        <div class="jobs-layout">
                            <Card title={item().title} heading="h1">
                                <p class="page-lead">
                                    {item().company.name} · {item().location}
                                </p>
                                <div class="tags">
                                    <span class="tag">{workplaces[item().workplace]}</span>
                                    <span class="tag">{employments[item().employment]}</span>
                                    <For each={item().tags}>
                                        {(tag) => <span class="tag">{tag}</span>}
                                    </For>
                                </div>
                                <Markdown source={item().description} />
                            </Card>
                            <aside class="jobs-sidebar">
                                <Card title="Apply">
                                    <Show when={item().salary}>
                                        <p class="job-salary">{salaryLabel(item().salary!)}</p>
                                    </Show>
                                    <Show
                                        when={item().isOpen}
                                        fallback={
                                            <p>This listing is no longer accepting applications.</p>
                                        }
                                    >
                                        <a
                                            class="button button--primary"
                                            href={item().applicationUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Apply on company site <Arrow direction="external" />
                                        </a>
                                    </Show>
                                </Card>
                                <Card title={item().company.name}>
                                    <Show when={item().company.logoUrl}>
                                        <img
                                            class="company-image"
                                            src={item().company.logoUrl}
                                            alt={item().company.name}
                                        />
                                    </Show>
                                    <a
                                        class="text-link"
                                        href={item().company.website}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Company website <Arrow direction="external" />
                                    </a>
                                </Card>
                            </aside>
                        </div>
                    </Page>
                </>
            )}
        </Show>
    );
}
