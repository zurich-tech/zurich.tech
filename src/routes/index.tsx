import { getCalendar, getArticles, getDirectory, getJobs, getGallery } from "../core/queries";
import { ArticleList } from "../component/article";
import { For, Show } from "solid-js";
import { Card } from "../component/card";
import { Button } from "../component/button";
import { JobEntry } from "../component/job";
import { Sponsors } from "../component/sponsors";
import { createAsync } from "@solidjs/router";
import { Gallery } from "../component/gallery";
import { Hero } from "../component/hero";
import { Newsletter } from "../component/newsletter";
import { Programme } from "../component/programme";
import { Seo } from "../component/seo";

/** Present the community map and published event programme. */
export default function Route() {
    // read published events and series from the live catalogue
    const entries = createAsync(() => getCalendar());
    const articles = createAsync(() => getArticles());
    const directory = createAsync(() => getDirectory());
    const jobs = createAsync(() => getJobs());
    const photos = createAsync(() => getGallery());

    return (
        <div class="bulletin">
            <Seo
                isHome
                title="zurich.tech"
                description="Talks, dinners, workshops and hackathons in Zürich. Jobs, news and the community archive."
            />

            {/* use the city as a compact identifying graphic */}
            <Hero eventCount={entries()?.length} />

            {/* keep the programme and community tools in separate readable columns */}
            <div class="bulletin-body">
                <section class="bulletin-events" aria-label="Events">
                    <Programme
                        entries={entries() ?? []}
                        series={directory()?.series ?? []}
                        limit={5}
                    />
                    <Show when={(photos()?.length ?? 0) > 0}>
                        <Gallery albums={photos() ?? []} />
                    </Show>
                </section>
                <aside class="bulletin-sidebar">
                    <ArticleList articles={articles() ?? []} isCompact limit={3} />
                    <div class="bulletin-intro">
                        <Newsletter />
                    </div>
                    <Sponsors />
                    <Card title="Jobs" titleHref="/jobs" class="jobs-overview">
                        <Show when={jobs()}>
                            {(listings) => (
                                <Show
                                    when={listings().length > 0}
                                    fallback={
                                        <p class="jobs-overview-empty text-soft">
                                            No open listings yet.
                                        </p>
                                    }
                                >
                                    <div class="jobs-overview-list">
                                        <For each={listings().slice(0, 10)}>
                                            {(job) => <JobEntry job={job} isCompact />}
                                        </For>
                                    </div>
                                </Show>
                            )}
                        </Show>
                        <div class="jobs-overview-actions">
                            <a class="text-link" href="/jobs">
                                All jobs
                            </a>
                            <Button href="/jobs/submit">Post a job</Button>
                        </div>
                    </Card>
                </aside>
            </div>
        </div>
    );
}
