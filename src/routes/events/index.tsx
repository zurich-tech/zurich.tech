import { createAsync } from "@solidjs/router";

import { Button } from "../../component/button";
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
                <PageHeader
                    actions={
                        <Button href="/events/propose" kind="ghost">
                            propose event
                        </Button>
                    }
                    title="events"
                />

                {/* calendar */}
                <Calendar entries={split().upcoming} title="upcoming" />
                <Calendar entries={split().past} title="past" />
            </Page>
        </>
    );
}
