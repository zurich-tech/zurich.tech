import { createAsync } from "@solidjs/router";

import { Calendar } from "../../component/calendar";
import { Page } from "../../component/page";
import { Seo } from "../../component/seo";
import { getCalendar } from "../../data/public";

/** Event index. */
export default function Route() {
    // calendar
    const entries = createAsync(() => getCalendar());
    const today = Date.now();

    return (
        <>
            <Seo title="events" description="zurich.tech events." />
            <Page>
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
                    dividerAt={today}
                    entries={entries() ?? []}
                    title="events"
                />
            </Page>
        </>
    );
}
