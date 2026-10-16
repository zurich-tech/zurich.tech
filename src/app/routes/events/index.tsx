import { getCalendar, getGallery } from "../../../events/queries";
import { getSeries } from "../../../organisations/queries";
import { Programme } from "../../../events/programme";
import { Page } from "../../page";
import { SeriesList } from "../../../events/series-list";
import { Contribute } from "../../contribute";
import { Seo } from "../../seo";
import { Show } from "solid-js";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => Promise.all([getCalendar(), getSeries(), getGallery()]),
};

/** Browse the complete event calendar. */
export default function Route() {
    const events = getCalendar.use(() => []);
    const series = getSeries.use(() => []);
    const albums = getGallery.use(() => []);

    return (
        <>
            <Seo
                title="Events"
                description="Find upcoming tech events in Zurich and browse past talks and meetups."
            />
            <Page class="publication">
                <div class="listing-layout">
                    <Show when={events() && series() && albums()}>
                        <Programme
                            heading="h1"
                            isCalendarEnabled
                            isPlanningEnabled
                            entries={events() ?? []}
                            albums={albums() ?? []}
                            series={series() ?? []}
                        />
                    </Show>
                    <aside class="listing-sidebar">
                        <SeriesList
                            series={series() ?? []}
                            entries={events() ?? []}
                            now={Date.now()}
                        />
                        <Contribute />
                    </aside>
                </div>
            </Page>
        </>
    );
}
