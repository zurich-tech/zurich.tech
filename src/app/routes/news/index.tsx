import { getArticles } from "../../../news/queries";
import { createAsync, useSearchParams } from "@solidjs/router";

import { Tags } from "../../../news/tags";
import { ArticleList } from "../../../news/article";
import { Page } from "../../page";
import { Seo } from "../../seo";

/** News index. */
export default function Route() {
    const [params] = useSearchParams();

    // articles
    const articles = createAsync(() => getArticles());

    return (
        <>
            <Seo title="News" description="zurich.tech news." />
            <Page>
                <div class="listing-layout">
                    {/* articles */}
                    <ArticleList
                        articles={articles() ?? []}
                        tag={typeof params.tag === "string" ? params.tag : undefined}
                        isSearchable
                        isPage
                    />
                    <aside class="listing-sidebar">
                        <Tags
                            articles={articles() ?? []}
                            selected={typeof params.tag === "string" ? params.tag : undefined}
                        />
                    </aside>
                </div>
            </Page>
        </>
    );
}
