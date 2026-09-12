import { getCalendar } from "../../../events/queries";
import { getDirectory } from "../../../organisations/queries";
import { createAsync } from "@solidjs/router";
import { Programme } from "../../../events/programme";
import { Page } from "../../page";
import { Seo } from "../../seo";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => Promise.all([getCalendar(), getDirectory()]),
};

/** Browse the complete event calendar. */
export default function Route() {
    const events = createAsync(() => getCalendar());
    const directory = createAsync(() => getDirectory());

    return (
        <>
            <Seo
                title="Events"
                description="Upcoming tech events in Zürich and the community archive."
            />
            <Page>
                <Programme
                    heading="h1"
                    isCalendarEnabled
                    isPlanningEnabled
                    entries={events() ?? []}
                    series={directory()?.series ?? []}
                />
            </Page>
        </>
    );
}
