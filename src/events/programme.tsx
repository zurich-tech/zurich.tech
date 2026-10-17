import { SearchNotice } from "../search/notice";
import { useCatalogue } from "../search/catalogue";
import { useSearch } from "../search/local";
import { matchesSearch } from "../../convex/search/ranking";
import { TableToolbar } from "../components/toolbar";
import { EventCalendar } from "./month";
import { pageSize } from "../app/site";
import { usePlanning, type CalendarEntry, type GalleryAlbum } from "./queries";

import { Card } from "../components/card";
import { FilterSelect } from "../components/filter-select";
import { FilterPills } from "../components/filter-pills";
import { type OrganiserPerson } from "./organiser";
import { EventList } from "./list";
import { previewEvents } from "./preview";
import "./programme.css";
import { createSignal, createMemo, createEffect, on, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { CalendarDays, List, Plus } from "lucide-solid";

/** Browse events in a single aligned calendar, filtered by period, year and series. */
export function Programme(props: {
    /** Include private drafts for signed-in team members. */
    isPlanningEnabled?: boolean;
    seriesId?: string;
    /** Offer a month view on the main Events page. */
    isCalendarEnabled?: boolean;
    /** Events to filter and paginate. */
    entries: CalendarEntry[];
    /** Approved photos for the full event list. */
    albums?: GalleryAlbum[];
    /** Maximum listings before linking to the full programme. */
    limit?: number;
    /** Heading level within the containing page. */
    heading?: "h1" | "h2";
    /** Series available as calendar filters. */
    series: {
        _id: string;
        slug: string;
        name: string;
        organiser?: OrganiserPerson | null;
        coOrganisers?: OrganiserPerson[];
    }[];
}) {
    // retain the selected filters and visible event count
    const [params, setParams] = useSearchParams();
    const { query, setQuery, terms } = useSearch();
    const catalogue = useCatalogue();
    const searched = createMemo(() =>
        !props.limit && terms().length ? catalogue.search(query(), "Events", Infinity) : [],
    );

    const [series, setSeries] = createSignal("all");
    const [visibleCount, setVisibleCount] = createSignal(pageSize);
    const now = Date.now();
    const compare = (left: CalendarEntry, right: CalendarEntry) => right.startsAt - left.startsAt;
    const planning = usePlanning(() => !!props.isPlanningEnabled);
    const entries = () =>
        [
            ...new Map(
                [...(planning.current()?.entries ?? []), ...props.entries].map((event) => [
                    event.id,
                    event,
                ]),
            ).values(),
        ].filter((event) => !props.seriesId || event.seriesId === props.seriesId);
    const isCalendar = () => !!props.isCalendarEnabled && params.view === "calendar";
    const isPreview = () => props.limit !== undefined;
    const period = () =>
        isPreview() || (params.period === "draft" && !planning.current())
            ? "all"
            : (params.period ?? "all");

    const year = () => (!isPreview() && typeof params.year === "string" ? params.year : "all");
    const yearFormat = new Intl.DateTimeFormat("en", {
        year: "numeric",
        timeZone: "Europe/Zurich",
    });
    const eventYear = (startsAt: number) => yearFormat.format(startsAt);
    const years = createMemo(() =>
        [...new Set(entries().map((event) => eventYear(event.startsAt)))].sort(),
    );

    // keep homepage series filters relevant to the unfiltered preview
    const availableSeries = createMemo(() => {
        if (!isPreview()) return props.series;
        const recent = previewEvents(entries(), props.limit!, now);

        return props.series.filter((item) => recent.some((event) => event.seriesId === item._id));
    });

    // select recent events before applying the display order
    const matches = createMemo(() =>
        entries()
            .filter(
                (event) =>
                    (period() === "all" ||
                        (period() === "draft"
                            ? event.status === "draft"
                            : period() === "past"
                              ? event.startsAt < now
                              : event.startsAt >= now)) &&
                    (isCalendar() || year() === "all" || eventYear(event.startsAt) === year()) &&
                    (isPreview() || !params.tag || event.topics.includes(String(params.tag))) &&
                    (series() === "all" || event.seriesId === series()) &&
                    (searched()?.some((result) => result.href === event.href) ||
                        matchesSearch(
                            [
                                event.title,
                                event.summary,
                                event.location,
                                ...event.topics,
                                event.organiser?.name,
                                ...event.coOrganisers.map((person) => person.name),
                            ].join(" "),
                            isPreview() ? [] : terms(),
                        )),
            )
            .sort(compare),
    );

    // keep recurring editions from crowding out the homepage programme
    const visible = createMemo(() =>
        isPreview()
            ? previewEvents(matches(), props.limit!, now)
            : matches().slice(0, visibleCount()),
    );

    // restart pagination only for filters, keeping background refreshes in place
    createEffect(
        on([series, period, year, isCalendar, () => params.tag, query], () =>
            setVisibleCount(pageSize),
        ),
    );

    // let the collection toolbar own spacing between filters and search
    const filters = () => (
        <div class="programme-tagbar" aria-label="Filter events">
            <Show when={!isPreview()}>
                <FilterPills
                    label="Event period"
                    value={
                        period() === "all" && (series() !== "all" || year() !== "all")
                            ? ""
                            : String(period())
                    }
                    options={[
                        { value: "all", label: "All" },
                        { value: "upcoming", label: "Upcoming" },
                        { value: "past", label: "Past" },
                        ...(planning.current() ? [{ value: "draft", label: "Draft" }] : []),
                    ]}
                    onChange={(value) => {
                        if (value === "all") setSeries("all");
                        setParams({
                            period: value === "all" ? undefined : value,
                            ...(value === "all" ? { year: undefined } : {}),
                        });
                    }}
                />
            </Show>
            <Show when={!props.seriesId && isPreview()}>
                <FilterPills
                    label="Event series"
                    value={series()}
                    options={[
                        ...(isPreview() ? [{ value: "all", label: "All" }] : []),
                        ...availableSeries().map((item) => ({
                            value: item._id,
                            label: item.name,
                        })),
                    ]}
                    onChange={(value) => setSeries(value === series() ? "all" : value)}
                />
            </Show>
            <Show when={!isPreview()}>
                <div class="programme-selects">
                    <Show when={!props.seriesId}>
                        <FilterSelect
                            label="Series"
                            value={series()}
                            onChange={setSeries}
                            options={[
                                { value: "all", label: "All series" },
                                ...availableSeries().map((item) => ({
                                    value: item._id,
                                    label: item.name,
                                })),
                            ]}
                        />
                    </Show>
                    <Show when={!isCalendar()}>
                        <FilterSelect
                            label="Year"
                            value={year()}
                            onChange={(value) =>
                                setParams({
                                    year: value === "all" ? undefined : value,
                                })
                            }
                            options={[
                                { value: "all", label: "All years" },
                                ...years().map((value) => ({ value, label: value })),
                            ]}
                        />
                    </Show>
                </div>
            </Show>
        </div>
    );

    return (
        <Card
            class={isPreview() ? "programme" : "programme programme--full"}
            heading={props.heading}
            meta={isPreview() ? `${visible().length} of ${matches().length}` : undefined}
            toolbar={
                <div class="row-actions">
                    <Show when={isPreview()}>
                        <a class="action-link" href="/series">
                            Series
                        </a>
                        <a class="action-link" href="/contribute#events">
                            Suggest an event
                        </a>
                    </Show>
                    <Show when={planning.canCreate(props.seriesId)}>
                        <a
                            class="action-link"
                            aria-label="New event"
                            title="New event"
                            href={props.seriesId ? `/submit?series=${props.seriesId}` : "/submit"}
                        >
                            <Plus size={18} aria-hidden="true" />
                        </a>
                    </Show>
                    <Show when={props.isCalendarEnabled}>
                        <div class="programme-views" role="group" aria-label="Event view">
                            <button
                                type="button"
                                title="List"
                                aria-label="List"
                                aria-pressed={!isCalendar()}
                                onClick={() => setParams({ view: undefined })}
                            >
                                <List size={18} aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                title="Calendar"
                                aria-label="Calendar"
                                aria-pressed={isCalendar()}
                                onClick={() =>
                                    setParams({
                                        view: "calendar",
                                        period: undefined,
                                        year: undefined,
                                    })
                                }
                            >
                                <CalendarDays size={18} aria-hidden="true" />
                            </button>
                        </div>
                    </Show>
                </div>
            }
            title={
                <Show when={props.heading !== "h1"} fallback="Events">
                    <a href="/events">Events</a>
                </Show>
            }
        >
            <Show when={!isPreview() && params.tag}>
                <div class="filter-bar">
                    <a class="tag" href="/events" aria-label={`Clear topic ${params.tag}`}>
                        {params.tag} ×
                    </a>
                </div>
            </Show>
            <Show
                when={isPreview()}
                fallback={
                    <TableToolbar value={query()} onSearch={setQuery} placeholder="Search events…">
                        {filters()}
                    </TableToolbar>
                }
            >
                {filters()}
            </Show>
            <Show when={planning.error()}>
                <div class="programme-planning-error">
                    <span>Could not load planning events.</span>
                    <button class="button" onClick={() => void planning.retry()}>
                        Try again
                    </button>
                </div>
            </Show>
            <Show when={!isPreview() && terms().length > 0 && catalogue.error()}>
                <SearchNotice
                    message="Search is limited to event summaries for now."
                    retry={catalogue.retry}
                />
            </Show>
            <Show
                when={isCalendar()}
                fallback={
                    <>
                        {/* render the current page with venue and upcoming tags */}
                        <EventList
                            events={visible()}
                            albums={props.albums}
                            series={props.series}
                            now={now}
                            terms={isPreview() ? [] : terms()}
                            excerpts={Object.fromEntries(
                                (searched() ?? [])
                                    .filter((result) => !matchesSearch(result.label, terms()))
                                    .map((result) => [result.href, result.description]),
                            )}
                            showToday={
                                period() === "all" &&
                                (year() === "all" || year() === eventYear(now))
                            }
                            actions={(event) => (
                                <Show when={planning.canEdit(event.id)}>
                                    <a
                                        class="action-link"
                                        aria-label={`Edit ${event.title}`}
                                        href={
                                            event.status === "draft"
                                                ? event.href
                                                : `/submit?event=${event.id}`
                                        }
                                    >
                                        Edit
                                    </a>
                                </Show>
                            )}
                        />
                        {/* reveal the next page without replacing existing entries */}
                        <Show when={!isPreview() && visibleCount() < matches().length}>
                            <div class="programme-more">
                                <button
                                    class="button"
                                    type="button"
                                    onClick={() => setVisibleCount((count) => count + pageSize)}
                                >
                                    Load more
                                </button>
                                <span>
                                    {Math.min(visibleCount(), matches().length)} of{" "}
                                    {matches().length}
                                </span>
                            </div>
                        </Show>
                        {/* explain an empty result without inventing events */}
                        <Show when={matches().length === 0}>
                            <p class="programme-empty-state">
                                {series() !== "all" || year() !== "all"
                                    ? "No events match these filters."
                                    : period() === "upcoming"
                                      ? "No upcoming events."
                                      : period() === "draft"
                                        ? "No draft events."
                                        : "No events."}
                            </p>
                        </Show>
                    </>
                }
            >
                <EventCalendar entries={matches()} />
            </Show>
        </Card>
    );
}
