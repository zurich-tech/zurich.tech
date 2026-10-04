import { getCalendar } from "../../../events/queries";
import { getSeries } from "../../../organisations/queries";
import { Programme } from "../../../events/programme";
import { Page } from "../../page";
import { SeriesList } from "../../../events/series-list";
import { Contribute } from "../../contribute";
import { Seo } from "../../seo";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => Promise.all([getCalendar(), getSeries()]),
};

/** Browse the complete event calendar. */
export default function Route() {
    const events = getCalendar.use(() => []);
    const series = getSeries.use(() => []);

    return (
        <>
            <Seo
                title="Events"
                description="Upcoming tech events in Zurich and the community archive."
            />
            <Page>
                <div class="listing-layout">
                    <Programme
                        heading="h1"
                        isCalendarEnabled
                        isPlanningEnabled
                        entries={events() ?? []}
                        series={series() ?? []}
                    />
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
