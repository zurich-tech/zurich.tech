import { getArticles } from "../../../news/queries";
import { useSearchParams } from "@solidjs/router";

import { ArticleList } from "../../../news/article";
import { Page } from "../../page";
import { TopicList } from "../../../news/tags";
import { Card } from "../../../components/card";
import { Arrow } from "../../../components/arrow";
import { site } from "../../site";
import { Seo } from "../../seo";
import { createMemo } from "solid-js";
import { FilterSelect } from "../../../components/filter-select";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getArticles(),
};

/** News index. */
export default function Route() {
    const [params, setParams] = useSearchParams();

    // articles and the selected tag
    const articles = getArticles.use(() => []);
    const tag = () => (typeof params.tag === "string" ? params.tag : undefined);
    const organisation = () =>
        typeof params.organisation === "string" ? params.organisation : undefined;
    const organisations = createMemo(() => {
        // keep all published organisations available when the feed is narrowed
        const entries = new Map(
            (articles() ?? []).flatMap((article) =>
                article.organisations.map((entry) => [entry.slug, entry.name] as const),
            ),
        );

        return [
            { value: "", label: "All organisations" },
            ...[...entries]
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([value, label]) => ({ value, label })),
        ];
    });

    return (
        <>
            <Seo title="News" description="Startup funding, research and tech news from Zurich." />
            <Page class="news-index publication">
                <div class="listing-layout">
                    {/* articles */}
                    <ArticleList
                        articles={articles() ?? []}
                        tag={tag()}
                        organisation={organisation()}
                        isSearchable
                        isPage
                        filters={
                            <div class="news-controls">
                                <FilterSelect
                                    label="Organisations"
                                    value={organisation() ?? ""}
                                    options={organisations()}
                                    onChange={(value) =>
                                        setParams({ organisation: value || undefined })
                                    }
                                />
                            </div>
                        }
                    />

                    {/* topics and suggestions */}
                    <aside class="listing-sidebar">
                        <div class="news-topics-desktop">
                            <TopicList
                                articles={articles() ?? []}
                                selected={tag()}
                                organisation={organisation()}
                            />
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
