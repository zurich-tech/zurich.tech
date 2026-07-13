import { createAsync } from "@solidjs/router";

import { DisplayBoard } from "../component/board";
import { Calendar } from "../component/calendar";
import { Page } from "../component/page";
import { ZurichPostcard } from "../component/postcard";
import { Seo } from "../component/seo";
import { getCalendar, splitCalendar } from "../data/public";

const pastLimit = 4;

/** Home page. */
export default function Route() {
    // calendar
    const entries = createAsync(() => getCalendar());
    const today = Date.now();
    const split = () => splitCalendar(entries() ?? []);
    const calendar = () => [...split().upcoming, ...split().past.slice(0, pastLimit)];

    return (
        <>
            <Seo title="zurich.tech" description="zurich.tech events." />
            <Page class="home-page">
                <DisplayBoard />
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
                    entries={calendar()}
                    title="events"
                    titleHref="/events"
                    view="compact"
                />
                <ZurichPostcard />
            </Page>
        </>
    );
}
