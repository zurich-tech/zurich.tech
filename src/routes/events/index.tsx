import { createAsync } from "@solidjs/router";

import { Calendar } from "../../component/calendar";
import { Page, PageHeader } from "../../component/page";
import { Seo } from "../../component/seo";
import { getCalendar, splitCalendar } from "../../data/public";

/** Event index. */
export default function Route() {
    // calendar
    const entries = createAsync(() => getCalendar());
    const split = () => splitCalendar(entries() ?? []);

    return (
        <>
            <Seo title="events" description="zurich.tech events." />
            <Page>
                <PageHeader title="events" />

                {/* calendar */}
                <Calendar
                    actions={
                        <>
                            <a class="table-command" href="/events/propose">
                                + event
                            </a>
                            <a class="table-command" href="/series/propose">
                                + series
                            </a>
                        </>
                    }
                    entries={split().upcoming}
                    title="upcoming"
                />
                <Calendar entries={split().past} title="past" />
            </Page>
        </>
    );
}
