import { getDirectory } from "../../../organisations/queries";
import { getCalendar } from "../../../events/queries";
import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";

import { Programme } from "../../../events/programme";
import { Arrow } from "../../../components/arrow";
import { Page, PageHeader } from "../../page";
import { Seo } from "../../seo";
import { NotFound } from "../../notfound";

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
