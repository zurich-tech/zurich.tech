import { createAsync, useParams } from "@solidjs/router";
import { Match, Show, Switch } from "solid-js";

import { Calendar } from "../../component/calendar";
import { Tags } from "../../component/meta";
import { NotFound } from "../../component/notfound";
import { DetailList, DetailRow, Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { getSeries, type PublicSeries } from "../../data/public";
import { routeParam } from "../../route";

/** Series detail page. */
export default function Route() {
    // params
    const params = useParams();
    const slug = routeParam("slug", params.slug);

    // series
    const series = createAsync(() => getSeries(slug), { deferStream: true });
    const title = () => series()?.title ?? slug;
    const today = Date.now();

    return (
        <Switch>
            {/* missing */}
            <Match when={series() === null}>
                <NotFound />
            </Match>

            {/* series */}
            <Match when={series() !== undefined}>
                <>
                    <Seo title={title()} description="zurich.tech series." />
                    <Page width="narrow">
                        <PageHeader
                            summary={series()?.summary ?? "series not found."}
                            title={title()}
                        />

                        {/* content */}
                        <div class="grid gap-8 md:grid-cols-[1fr_18rem]">
                            {/* main column */}
                            <Calendar
                                dividerAt={today}
                                entries={series()?.entries ?? []}
                                title="events"
                            />

                            {/* side column */}
                            <div class="grid content-start gap-8">
                                <Details series={series()} />
                                <Show when={series()}>
                                    {(series) => <Description series={series()} />}
                                </Show>
                            </div>
                        </div>
                    </Page>
                </>
            </Match>
        </Switch>
    );
}

/** Series facts. */
function Details(props: { series: PublicSeries | null | undefined }) {
    return (
        <Section title="details">
            <DetailList>
                <DetailRow label="cadence" value={props.series?.cadence ?? "-"} />
                <DetailRow label="subscribers" value={props.series?.subscriberCount ?? 0} />
                <DetailRow label="owner" value={props.series?.ownerHandle ?? "-"} />
            </DetailList>
        </Section>
    );
}

/** Series description and tags. */
function Description(props: { series: PublicSeries }) {
    return (
        <Section title="description">
            <div class="grid gap-4">
                <p class="text-soft">{props.series.summary ?? "no description yet."}</p>
                <Tags values={props.series.tags} />
            </div>
        </Section>
    );
}
