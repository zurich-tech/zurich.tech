import { createAsync } from "@solidjs/router";

import { ArticleList } from "../component/article";
import { Calendar } from "../component/calendar";
import { Page } from "../component/page";
import { Seo } from "../component/seo";
import { getArticles, getCalendar, splitCalendar } from "../data/public";

const articleLimit = 3;
const pastLimit = 3;

/** Home page. */
export default function Route() {
    // public records
    const entries = createAsync(() => getCalendar());
    const articles = createAsync(() => getArticles());
    const today = Date.now();

    // keep the nearest events around today's divider
    const split = () => splitCalendar(entries() ?? []);
    const calendar = () => [...split().upcoming, ...split().past.slice(0, pastLimit)];

    return (
        <>
            <Seo title="zurich.tech" description="zurich.tech events." />
            <Page>
                {/* events */}
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
                />

                {/* news */}
                <ArticleList articles={articles() ?? []} limit={articleLimit} titleHref="/news" />
            </Page>
        </>
    );
}
