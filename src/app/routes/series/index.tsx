import { createMemo, For, Show } from "solid-js";
import { ArrowRight } from "lucide-solid";
import { useSearch } from "../../../search/local";
import { matchesSearch } from "../../../../convex/search/ranking";
import { TableToolbar } from "../../../components/toolbar";
import { Highlight } from "../../../components/highlight";
import { Markdown } from "../../../components/markdown";
import { getSeries } from "../../../organisations/queries";
import { getCalendar } from "../../../events/queries";
import { seriesActivity } from "../../../events/activity";
import { Organisers } from "../../../events/organiser";
import { EventTags } from "../../../events/tags";
import { EditLink } from "../../../auth/edit";
import { Page, PageHeader } from "../../page";
import { timeZone } from "../../../../convex/events/time";
import { Seo } from "../../seo";
import "../../../events/catalogue.css";

/** Display unambiguous event dates in Zurich time. */
const eventDate = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
});

/** Fetch published series and the public programme together. */
export const route = { preload: () => Promise.all([getSeries(), getCalendar()]) };

/** Present a compact directory, leaving full histories on each series page. */
export default function Route() {
    const series = getSeries.use(() => []);
    const events = getCalendar.use(() => []);
    const now = Date.now();
    const { query, setQuery, terms } = useSearch();

    // group the calendar once and put the nearest upcoming series first
    const rows = createMemo(() => {
        const activity = seriesActivity(events() ?? [], now);

        return (series() ?? [])
            .map((item) => ({ item, activity: activity.get(item._id) }))
            .filter(({ item, activity }) => item.status !== "archived" || activity !== undefined)
            .sort(
                (left, right) =>
                    (left.activity?.next?.startsAt ?? Infinity) -
                        (right.activity?.next?.startsAt ?? Infinity) ||
                    left.item.name.localeCompare(right.item.name),
            );
    });

    // retain topic and organiser searches alongside names and descriptions
    const matches = () =>
        rows().filter(({ item }) =>
            matchesSearch(
                [
                    item.name,
                    item.description,
                    ...item.topics,
                    item.organiser?.name,
                    ...item.coOrganisers.map((person) => person.name),
                ].join(" "),
                terms(),
            ),
        );

    return (
        <>
            <Seo title="Series" description="Tech event series in Zurich." />
            <Page class="series-catalogue publication">
                <PageHeader
                    title="Series"
                    actions={
                        <EditLink href="/admin?section=series&series=new" label="New series" />
                    }
                />
                <TableToolbar value={query()} onSearch={setQuery} placeholder="Search series…">
                    <span class="series-count">{matches().length} series</span>
                </TableToolbar>

                {/* keep each series identity separate from its next or latest event */}
                <div class="series-directory">
                    <For each={matches()}>
                        {({ item, activity }) => {
                            const event = activity?.next ?? activity?.latest;

                            return (
                                <article class="series-row" aria-labelledby={`series-${item.slug}`}>
                                    <div class="series-row-copy">
                                        <div class="series-row-heading">
                                            <h2 id={`series-${item.slug}`}>
                                                <a href={`/series/${item.slug}`}>
                                                    <Highlight text={item.name} terms={terms()} />
                                                    <ArrowRight size={18} aria-hidden="true" />
                                                </a>
                                            </h2>
                                            <div class="row-actions">
                                                <EditLink
                                                    href={`/admin?section=series&schedule=new&series=${item._id}`}
                                                    seriesId={item._id}
                                                    role="organiser"
                                                    label="New schedule"
                                                />
                                                <EditLink
                                                    href={`/admin?section=series&series=${item._id}`}
                                                    seriesId={item._id}
                                                    label="Edit"
                                                />
                                            </div>
                                        </div>
                                        <Show when={item.description.trim()}>
                                            <div class="series-row-description">
                                                <Markdown source={item.description} />
                                            </div>
                                        </Show>
                                        <div class="series-row-meta">
                                            <EventTags
                                                detailed
                                                topics={item.topics.filter(
                                                    (topic) => topic !== item.slug,
                                                )}
                                            />
                                            <Show when={activity?.held}>
                                                <span>
                                                    {activity!.held}{" "}
                                                    {activity!.held === 1 ? "event" : "events"} held
                                                </span>
                                            </Show>
                                            <Show when={item.status === "archived"}>
                                                <span>Archived</span>
                                            </Show>
                                        </div>
                                        <Show when={item.organiser || item.coOrganisers.length}>
                                            <div
                                                class="series-row-organisers"
                                                aria-label="Organisers"
                                            >
                                                <Organisers
                                                    primary={item.organiser}
                                                    others={item.coOrganisers}
                                                />
                                            </div>
                                        </Show>
                                    </div>
                                    <div
                                        class="series-row-event"
                                        classList={{
                                            "series-row-event--upcoming": !!activity?.next,
                                        }}
                                    >
                                        <Show
                                            when={event}
                                            fallback={
                                                <span class="series-activity-label">
                                                    {item.status === "archived"
                                                        ? "No events held"
                                                        : "First event to be announced"}
                                                </span>
                                            }
                                        >
                                            {(event) => (
                                                <>
                                                    <span class="series-activity-label">
                                                        {activity?.next
                                                            ? "Next event"
                                                            : "Latest event"}
                                                    </span>
                                                    <time
                                                        dateTime={new Date(
                                                            event().startsAt,
                                                        ).toISOString()}
                                                    >
                                                        {eventDate.format(event().startsAt)}
                                                    </time>
                                                    <a
                                                        class="series-event-title"
                                                        href={`/events/${event().slug}`}
                                                    >
                                                        {event().title}
                                                    </a>
                                                    <Show when={event().location}>
                                                        <span class="series-event-venue">
                                                            {event().location}
                                                        </span>
                                                    </Show>
                                                </>
                                            )}
                                        </Show>
                                    </div>
                                </article>
                            );
                        }}
                    </For>
                    <Show when={series() && matches().length === 0}>
                        <p class="empty-copy">
                            {series()!.length
                                ? "No series match your search."
                                : "No series listed yet."}
                        </p>
                    </Show>
                </div>

                {/* offer new organisers one clear route without a permanent sidebar */}
                <section class="series-contribute">
                    <div>
                        <h2>Start a series</h2>
                        <p>
                            Run a recurring meetup in Zurich? We help with venues, speakers and
                            getting the word out.
                        </p>
                    </div>
                    <a class="button" href="/contribute#events">
                        Suggest a series <ArrowRight size={16} aria-hidden="true" />
                    </a>
                </section>
            </Page>
        </>
    );
}
