import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";

import { Button } from "../../component/button";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { getSeriesList, type PublicSeries } from "../../data/public";

/** Series index. */
export default function Route() {
    // series
    const series = createAsync(() => getSeriesList());

    return (
        <>
            <Seo title="series" description="zurich.tech series." />
            <Page>
                <PageHeader
                    actions={
                        <Button href="/series/propose" kind="ghost">
                            start series
                        </Button>
                    }
                    title="series"
                />

                {/* series */}
                <SeriesDirectory series={series() ?? []} />
            </Page>
        </>
    );
}

/** Series directory, a legend box of series rows. */
function SeriesDirectory(props: { series: PublicSeries[] }) {
    return (
        <Section title="series" meta={`${props.series.length} running`}>
            {/* empty */}
            <Show when={props.series.length > 0} fallback={<p class="text-soft">nothing yet.</p>}>
                {/* rows */}
                <ol class="grid">
                    <For each={props.series}>{(series) => <SeriesRow series={series} />}</For>
                </ol>
            </Show>
        </Section>
    );
}

/** Series row: caret gutter, title, summary, cadence and subscriber count. */
function SeriesRow(props: { series: PublicSeries }) {
    return (
        <li class="-mx-2 border-b border-line last:border-b-0">
            <a
                class="group grid grid-cols-[16px_1fr] items-start gap-2 px-2 py-2 outline-none focus:bg-ink hover:bg-ink"
                href={`/series/${props.series.slug}`}
            >
                {/* caret */}
                <span class="text-transparent group-focus:text-paper group-hover:text-paper">
                    {">"}
                </span>

                {/* title, summary, meta */}
                <span class="grid gap-0.5">
                    <span class="flex flex-wrap items-baseline justify-between gap-3">
                        <span class="font-medium group-focus:text-paper group-hover:text-paper">
                            {props.series.title}
                        </span>
                        <span class="text-xs text-soft group-focus:text-paper/60 group-hover:text-paper/60">
                            ↻ {props.series.cadence} · {props.series.subscriberCount} subscribed
                        </span>
                    </span>
                    <Show when={props.series.summary}>
                        <span class="text-[13px] text-soft group-focus:text-paper/60 group-hover:text-paper/60">
                            {props.series.summary}
                        </span>
                    </Show>
                </span>
            </a>
        </li>
    );
}
