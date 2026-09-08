import { getDirectory, getCalendar } from "../../core/queries";
import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";

import { Programme } from "../../component/programme";
import { Arrow } from "../../component/arrow";
import { Page, PageHeader } from "../../component/page";
import { Seo } from "../../component/seo";
import { NotFound } from "../../component/notfound";

/** Collect the upcoming gatherings and archive of a recurring series. */
export default function Route() {
    const params = useParams();
    const directory = createAsync(() => getDirectory());
    const events = createAsync(() => getCalendar());
    const series = () => directory()?.series.find((item) => item.slug === params.slug);

    return (
        <Show when={series()} fallback={directory() ? <NotFound /> : null}>
            {(item) => (
                <>
                    <Seo title={item().name} description={item().description} />
                    <Page width="narrow">
                        <a class="eyebrow" href="/events">
                            <Arrow direction="left" /> Events
                        </a>
                        <PageHeader title={item().name} />
                        <p class="page-lead">{item().description}</p>
                        <Programme
                            series={[]}
                            entries={
                                events()?.filter(
                                    (event) =>
                                        event.seriesId === item()._id ||
                                        event.tags.includes(item().slug),
                                ) ?? []
                            }
                        />
                    </Page>
                </>
            )}
        </Show>
    );
}
