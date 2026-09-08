import { getCalendar, getDirectory } from "../../core/queries";
import { createAsync } from "@solidjs/router";
import { Programme } from "../../component/programme";
import { Page } from "../../component/page";
import { Seo } from "../../component/seo";

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
