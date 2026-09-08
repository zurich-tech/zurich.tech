import { getCalendar, getArticles, getDirectory } from "../core/queries";
import { ArticleList } from "../component/article";
import { Sponsors } from "../component/sponsors";
import { createAsync } from "@solidjs/router";
import { Hero } from "../component/hero";
import { Newsletter } from "../component/newsletter";
import { Programme } from "../component/programme";
import { Seo } from "../component/seo";

/** Present the community map and published event programme. */
export default function Route() {
    // read published events and series from the live catalogue
    const entries = createAsync(() => getCalendar());
    const articles = createAsync(() => getArticles());
    const directory = createAsync(() => getDirectory());

    return (
        <div class="bulletin">
            <Seo
                isHome
                title="zurich.tech"
                description="Talks, dinners, workshops and hackathons in Zürich. Jobs, news and the community archive."
            />

            {/* use the city as a compact identifying graphic */}
            <Hero eventCount={entries()?.length} />

            {/* keep the programme and community tools in separate readable columns */}
            <div class="bulletin-body">
                <section class="bulletin-events" aria-label="Events">
                    <Programme entries={entries() ?? []} series={directory()?.series ?? []} />
                </section>
                <aside class="bulletin-sidebar">
                    <ArticleList articles={articles() ?? []} isCompact limit={3} />
                    <div class="bulletin-intro">
                        <Newsletter />
                    </div>
                    <Sponsors />
                </aside>
            </div>
        </div>
    );
}
