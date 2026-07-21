import { createAsync } from "@solidjs/router";

import { ArticleList } from "../../component/article";
import { Page } from "../../component/page";
import { Seo } from "../../component/seo";
import { getArticles } from "../../data/public";

/** News index. */
export default function Route() {
    // articles
    const articles = createAsync(() => getArticles());

    return (
        <>
            <Seo title="news" description="zurich.tech news." />
            <Page>
                {/* articles */}
                <ArticleList articles={articles() ?? []} isSearchable />
            </Page>
        </>
    );
}
