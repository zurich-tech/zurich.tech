import { createAsync } from "@solidjs/router";
import { For, Show, createMemo, createSignal } from "solid-js";

import { DirectoryList, DirectoryRow } from "../../component/list";
import { Page, PageHeader, Section } from "../../component/page";
import { Seo } from "../../component/seo";
import { TableToolbar } from "../../component/toolbar";
import { getSeriesList, type PublicSeries } from "../../data/public";

/** Series index. */
export default function Route() {
    // series
    const series = createAsync(() => getSeriesList());

    return (
        <>
            <Seo title="series" description="zurich.tech series." />
            <Page>
                <PageHeader title="series" />

                {/* series */}
                <SeriesDirectory series={series() ?? []} />
            </Page>
        </>
    );
}

/** Series directory, a legend box of series rows. */
function SeriesDirectory(props: { series: PublicSeries[] }) {
    const [query, setQuery] = createSignal("");

    // filter visible series by their searchable text
    const visible = createMemo(() => {
        const text = query().trim().toLowerCase();
        if (text.length === 0) {
            return props.series;
        }

        return props.series.filter((series) =>
            `${series.title} ${series.summary ?? ""} ${series.tags.join(" ")}`
                .toLowerCase()
                .includes(text),
        );
    });

    return (
        <Section
            meta={`${visible().length} / ${props.series.length}`}
            title="series"
            toolbar={
                <TableToolbar
                    actions={
                        <a class="table-command" href="/series/propose">
                            + series
                        </a>
                    }
                    onSearch={setQuery}
                    placeholder="search series..."
                />
            }
        >
            {/* empty */}
            <Show when={visible().length > 0} fallback={<p class="text-soft">no series</p>}>
                <DirectoryList>
                    <For each={visible()}>
                        {(series) => (
                            <DirectoryRow
                                href={`/series/${series.slug}`}
                                meta={`${series.cadence} / ${series.subscriberCount} subscribed`}
                                summary={series.summary}
                                title={series.title}
                            />
                        )}
                    </For>
                </DirectoryList>
            </Show>
        </Section>
    );
}
