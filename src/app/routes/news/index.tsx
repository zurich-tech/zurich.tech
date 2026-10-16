import { getArticles } from "../../../news/queries";
import { useSearchParams } from "@solidjs/router";

import { ArticleList } from "../../../news/article";
import { Page } from "../../page";
import { TopicList } from "../../../news/tags";
import { Card } from "../../../components/card";
import { Arrow } from "../../../components/arrow";
import { site } from "../../site";
import { Seo } from "../../seo";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getArticles(),
};

/** News index. */
export default function Route() {
    const [params] = useSearchParams();

    // articles and the selected tag
    const articles = getArticles.use(() => []);
    const tag = () => (typeof params.tag === "string" ? params.tag : undefined);

    return (
        <>
            <Seo title="News" description="Startup funding, research and tech news from Zurich." />
            <Page class="news-index publication">
                <div class="listing-layout">
                    {/* articles */}
                    <ArticleList articles={articles() ?? []} tag={tag()} isSearchable isPage />

                    {/* topics and suggestions */}
                    <aside class="listing-sidebar">
                        <div class="news-topics-desktop">
                            <TopicList articles={articles() ?? []} selected={tag()} />
                        </div>
                        <Card title="Suggest a story" class="offer-card">
                            <p>
                                Built something worth sharing? Send us a demo, a paper or a
                                substantial launch from Zurich.
                            </p>
                            <a
                                class="button button--primary"
                                href={site.socials.discord}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Suggest a story <Arrow direction="external" />
                            </a>
                        </Card>
                    </aside>
                </div>
            </Page>
        </>
    );
}
