import { createAsync } from "@solidjs/router";
import { For, Show } from "solid-js";
import { getDirectory } from "../../../organisations/queries";
import { getCalendar } from "../../../events/queries";
import { Card } from "../../../components/card";
import { Markdown } from "../../../components/markdown";
import { EventTags } from "../../../events/tags";
import { EventEntry } from "../../../events/entry";
import { EditLink } from "../../../auth/edit";
import { Page, PageHeader } from "../../page";
import { Seo } from "../../seo";

/** Fetch the directory and public programme together. */
export const route = { preload: () => Promise.all([getDirectory(), getCalendar()]) };

/** Discover each series through its description and latest events. */
export default function Route() {
    const directory = createAsync(() => getDirectory());
    const events = createAsync(() => getCalendar());
    const now = Date.now();

    return (
        <>
            <Seo title="Series" description="Tech event series in Zürich." />
            <Page>
                <PageHeader
                    title="Series"
                    actions={
                        <EditLink href="/admin?section=series&series=new" label="New series" />
                    }
                />
                <For each={directory()?.series}>
                    {(series) => {
                        const recent = () =>
                            (events() ?? [])
                                .filter((event) => event.seriesId === series._id)
                                .sort((left, right) => right.startsAt - left.startsAt)
                                .slice(0, 3);

                        return (
                            <Card
                                title={series.name}
                                titleHref={`/series/${series.slug}`}
                                class="card--sections series-preview"
                                toolbar={
                                    <div class="row-actions">
                                        <EditLink
                                            href={`/admin?section=series&series=${series._id}`}
                                            seriesId={series._id}
                                            label="Edit"
                                        />
                                        <EditLink
                                            href={`/admin?section=series&schedule=new&series=${series._id}`}
                                            seriesId={series._id}
                                            role="organiser"
                                            label="New schedule"
                                        />
                                    </div>
                                }
                            >
                                <div class="card-section">
                                    <Markdown source={series.description} />
                                    <EventTags
                                        topics={series.topics.filter(
                                            (topic) => topic !== series.slug,
                                        )}
                                    />
                                </div>
                                <Show when={recent().length}>
                                    <div class="card-section series-events">
                                        <For each={recent()}>
                                            {(event) => (
                                                <EventEntry
                                                    event={event}
                                                    now={now}
                                                    actions={
                                                        <EditLink
                                                            href={`/submit?event=${event.id}`}
                                                        />
                                                    }
                                                />
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </Card>
                        );
                    }}
                </For>
            </Page>
        </>
    );
}
