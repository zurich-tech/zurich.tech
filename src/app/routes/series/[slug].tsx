import { SeriesDetails } from "../../../events/series-details";
import { useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { getDirectory } from "../../../organisations/queries";
import { getCalendar } from "../../../events/queries";
import { Programme } from "../../../events/programme";
import { EditLink } from "../../../auth/edit";
import { Page, ItemHeader } from "../../page";
import { Seo } from "../../seo";
import { NotFound } from "../../notfound";

export const route = { preload: () => Promise.all([getDirectory(), getCalendar()]) };

/** Browse the description and complete programme of one series. */
export default function Route() {
    const params = useParams();
    const directory = getDirectory.use(() => []);
    const events = getCalendar.use(() => []);
    const series = () => directory()?.series.find((item) => item.slug === params.slug);
    return (
        <Show when={directory()}>
            <Show when={series()} fallback={<NotFound />}>
                {(item) => (
                    <>
                        <Seo title={item().name} description={item().description} />
                        <Page>
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
                                        label="Edit series"
                                    />
                                }
                            />
                            <Programme
                                entries={events() ?? []}
                                series={directory()!.series}
                                seriesId={item()._id}
                                isCalendarEnabled
                                isPlanningEnabled
                            />
                        </Page>
                    </>
                )}
            </Show>
        </Show>
    );
}
