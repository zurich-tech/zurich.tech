import { createAsync } from "@solidjs/router";

import { ArticleList } from "../component/article";
import { Calendar } from "../component/calendar";
import { Page } from "../component/page";
import { Seo } from "../component/seo";
import { getArticles, getCalendar } from "../data/public";

const articleLimit = 3;
const eventLimit = 5;

/** Home page. */
export default function Route() {
    // public records
    const entries = createAsync(() => getCalendar());
    const articles = createAsync(() => getArticles());
    const today = Date.now();

    return (
        <>
            <Seo title="zurich.tech" description="zurich.tech events." />
            <Page>
                {/* events */}
                <Calendar
                    dividerAt={today}
                    entries={entries() ?? []}
                    limit={eventLimit}
                    title="events"
                    titleHref="/events"
                />

                {/* news */}
                <ArticleList articles={articles() ?? []} limit={articleLimit} titleHref="/news" />
            </Page>
        </>
    );
}
