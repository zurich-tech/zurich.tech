import { Arrow } from "../../../components/arrow";
import { Share } from "../../../components/share";
import { Contribute } from "../../contribute";
import { site } from "../../site";
import { SeriesDetails } from "../../../events/series-details";
import { useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { getSeries } from "../../../organisations/queries";
import { getCalendar } from "../../../events/queries";
import { Programme } from "../../../events/programme";
import { EditLink } from "../../../auth/edit";
import { Page, ItemHeader } from "../../page";
import { Seo } from "../../seo";
import { NotFound } from "../../notfound";

export const route = { preload: () => Promise.all([getSeries(), getCalendar()]) };

/** Browse the description and complete programme of one series. */
export default function Route() {
    const params = useParams();
    const seriesList = getSeries.use(() => []);
    const events = getCalendar.use(() => []);
    const series = () => seriesList()?.find((item) => item.slug === params.slug);
    return (
        <Show when={seriesList()}>
            <Show when={series()} fallback={<NotFound />}>
                {(item) => (
                    <>
                        <Seo title={item().name} description={item().description} />
                        <Page class="publication">
                            <a class="eyebrow" href="/series">
                                <Arrow direction="left" /> Series
                            </a>
                            <ItemHeader
                                title={item().name}
                                class="series-header"
                                summary={
                                    <SeriesDetails
                                        series={item()}
                                        events={events()?.filter(
                                            (event) => event.seriesId === item()._id,
                                        )}
                                    />
                                }
                                actions={
                                    <EditLink
                                        href={`/admin?section=series&series=${item()._id}`}
                                        seriesId={item()._id}
                                    />
                                }
                            />
                            <div class="detail-layout">
                                <div class="detail-content">
                                    <Show when={events()}>
                                        <Programme
                                            entries={events() ?? []}
                                            series={seriesList()!}
                                            seriesId={item()._id}
                                            isCalendarEnabled
                                            isPlanningEnabled
                                        />
                                    </Show>
                                </div>
                                <aside class="detail-aside">
                                    <Contribute />
                                    <Share
                                        title={item().name}
                                        url={`${site.url}/series/${item().slug}`}
                                    />
                                </aside>
                            </div>
                        </Page>
                    </>
                )}
            </Show>
        </Show>
    );
}
