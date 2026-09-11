import { getCalendar } from "../../../events/queries";
import { getDirectory } from "../../../organisations/queries";
import { createAsync } from "@solidjs/router";
import { Programme } from "../../../events/programme";
import { Page } from "../../page";
import { Seo } from "../../seo";

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
            <Page width="narrow">
                <Programme
                    heading="h1"
                    entries={events() ?? []}
                    series={directory()?.series ?? []}
                />
            </Page>
        </>
    );
}
