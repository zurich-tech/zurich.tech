import { useSearch } from "../../../search/local";
import { matchesSearch } from "../../../search/search";
import { TableToolbar } from "../../../components/toolbar";
import { Highlight } from "../../../components/highlight";
import { For, Show } from "solid-js";
import { getDirectory } from "../../../organisations/queries";
import { getCalendar } from "../../../events/queries";
import { Card } from "../../../components/card";
import { SeriesDetails } from "../../../events/series-details";
import { EventList } from "../../../events/list";
import { EditLink } from "../../../auth/edit";
import { Page } from "../../page";
import { Contribute } from "../../contribute";
import { Seo } from "../../seo";

/** Fetch the directory and public programme together. */
export const route = { preload: () => Promise.all([getDirectory(), getCalendar()]) };

/** Discover each series through its description and latest events. */
export default function Route() {
    const directory = getDirectory.use(() => []);
    const events = getCalendar.use(() => []);
    const now = Date.now();
    const { query, setQuery, terms } = useSearch();

    // keep search results and their empty state in sync
    const matches = () =>
        directory()?.series.filter((series) =>
            matchesSearch(
                [
                    series.name,
                    series.description,
                    ...series.topics,
                    series.organiser?.name,
                    ...series.coOrganisers.map((person) => person.name),
                ].join(" "),
                terms(),
            ),
        ) ?? [];

    return (
        <>
            <Seo title="Series" description="Tech event series in Zurich." />
            <Page>
                <div class="listing-layout">
                    <Card
                        title="Series"
                        heading="h1"
                        class="listing-card"
                        toolbar={
                            <EditLink href="/admin?section=series&series=new" label="New series" />
                        }
                    >
                        <TableToolbar
                            value={query()}
                            onSearch={setQuery}
                            placeholder="Search series…"
                        />
                        <For each={matches()}>
                            {(series) => {
                                const occurrences = () =>
                                    events()?.filter((event) => event.seriesId === series._id);
                                const recent = () =>
                                    [...(occurrences() ?? [])]
                                        .sort((left, right) => right.startsAt - left.startsAt)
                                        .slice(0, 3);

                                return (
                                    <Card
                                        title={<Highlight text={series.name} terms={terms()} />}
                                        titleHref={`/series/${series.slug}`}
                                        class="card--sections series-preview"
                                        toolbar={
                                            <div class="row-actions">
                                                <EditLink
                                                    href={`/admin?section=series&schedule=new&series=${series._id}`}
                                                    seriesId={series._id}
                                                    role="organiser"
                                                    label="New schedule"
                                                />
                                                <EditLink
                                                    href={`/admin?section=series&series=${series._id}`}
                                                    seriesId={series._id}
                                                    label="Edit"
                                                />
                                            </div>
                                        }
                                    >
                                        <div class="card-section">
                                            <SeriesDetails series={series} events={occurrences()} />
                                        </div>
                                        <Show when={recent().length}>
                                            <EventList
                                                events={recent()}
                                                series={directory()!.series}
                                                now={now}
                                                showToday
                                                actions={(event) => (
                                                    <EditLink
                                                        href={`/submit?event=${event.id}`}
                                                        eventId={event.id}
                                                    />
                                                )}
                                            />
                                        </Show>
                                    </Card>
                                );
                            }}
                        </For>
                        <Show when={directory() && matches().length === 0}>
                            <p class="empty-copy">
                                {directory()!.series.length
                                    ? "No series match your search."
                                    : "No series listed yet."}
                            </p>
                        </Show>
                    </Card>

                    {/* invite new organisers, then other ways to take part */}
                    <aside class="listing-sidebar">
                        <Card title="Start a series" class="offer-card">
                            <p>
                                Run a recurring meetup in Zurich? We help with venues, speakers and
                                getting the word out.
                            </p>
                            <a class="button button--primary" href="/contribute#events">
                                Suggest a series
                            </a>
                        </Card>
                        <Contribute />
                    </aside>
                </div>
            </Page>
        </>
    );
}
