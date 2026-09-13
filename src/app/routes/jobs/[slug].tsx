import { EditLink } from "../../../auth/edit";
import { Image } from "../../../components/image";
import { getJob } from "../../../jobs/queries";
import { createAsync, useParams } from "@solidjs/router";
import { Show, For } from "solid-js";
import { routeParam } from "../../params";

import { Card } from "../../../components/card";
import { Page, ItemHeader } from "../../page";
import { Seo } from "../../seo";
import { NotFound } from "../../notfound";
import { Markdown } from "../../../components/markdown";
import { Arrow } from "../../../components/arrow";
import { salaryLabel } from "../../../jobs/job";
import { workplaces, employments } from "../../../jobs/filters";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: ({ params }: { params: Record<string, string> }) => getJob(params.slug),
};

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
                        <ItemHeader
                            title={item().title}
                            summary={`${item().company.name} · ${item().location}`}
                            actions={<EditLink href={`/jobs/submit?edit=${item().id}`} />}
                        >
                            <span class="tag">{workplaces[item().workplace]}</span>
                            <span class="tag">{employments[item().employment]}</span>
                            <For each={item().tags}>{(tag) => <span class="tag">{tag}</span>}</For>
                        </ItemHeader>
                        <div class="listing-layout">
                            <Card title="About">
                                <Markdown source={item().description} />
                            </Card>
                            <aside class="listing-sidebar">
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
                                        <Image
                                            class="company-image"
                                            src={item().company.logoUrl}
                                            darkSrc={item().company.logoDarkUrl}
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
