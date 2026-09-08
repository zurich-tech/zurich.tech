import { getArticles } from "../../core/queries";
import { createAsync } from "@solidjs/router";

import { ArticleList } from "../../component/article";
import { Page } from "../../component/page";
import { Seo } from "../../component/seo";

/** News index. */
export default function Route() {
    // articles
    const articles = createAsync(() => getArticles());

    return (
        <>
            <Seo title="News" description="zurich.tech news." />
            <Page width="narrow">
                {/* articles */}
                <ArticleList articles={articles() ?? []} isSearchable isPage />
            </Page>
        </>
    );
}
