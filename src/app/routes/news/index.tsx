import { getArticles } from "../../../news/queries";
import { useSearchParams } from "@solidjs/router";

import { ArticleList } from "../../../news/article";
import { Page } from "../../page";
import { Seo } from "../../seo";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getArticles(),
};

/** News index. */
export default function Route() {
    const [params] = useSearchParams();

    // articles
    const articles = getArticles.use(() => []);

    return (
        <>
            <Seo
                title="News"
                description="Startup funding, technology and community news from Zurich."
            />
            <Page>
                <div class="news-page">
                    {/* articles */}
                    <ArticleList
                        articles={articles() ?? []}
                        tag={typeof params.tag === "string" ? params.tag : undefined}
                        isSearchable
                        isPage
                    />
                </div>
            </Page>
        </>
    );
}
