import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { getDirectory } from "../../../organisations/queries";
import { getCalendar } from "../../../events/queries";
import { Programme } from "../../../events/programme";
import { EventTags } from "../../../events/tags";
import { Markdown } from "../../../components/markdown";
import { TeamEdit } from "../../../auth/edit";
import { Page, ItemHeader } from "../../page";
import { Seo } from "../../seo";
import { NotFound } from "../../notfound";

export const route = { preload: () => Promise.all([getDirectory(), getCalendar()]) };

/** Browse the description and complete programme of one series. */
export default function Route() {
    const params = useParams();
    const directory = createAsync(() => getDirectory());
    const events = createAsync(() => getCalendar());
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
                                summary={<Markdown source={item().description} />}
                                actions={
                                    <TeamEdit
                                        href={`/admin?section=series&series=${item()._id}`}
                                        label="Edit series"
                                    />
                                }
                            >
                                <EventTags
                                    topics={item().topics.filter((topic) => topic !== item().slug)}
                                />
                            </ItemHeader>
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
