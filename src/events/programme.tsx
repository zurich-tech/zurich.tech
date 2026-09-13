import { isTentative } from "../../convex/events/conditions";
import { EventCalendar } from "./month";
import { pageSize } from "../app/site";
import { usePlanning, useConfirmationRefresh, getCalendar, type CalendarEntry } from "./queries";

import { Card } from "../components/card";
import { FilterPills } from "../components/filter-pills";
import { EventEntry } from "./entry";
import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js";
import { useSearchParams, revalidate } from "@solidjs/router";

/** Browse events in a single aligned calendar, filtered by period, year and series. */
export function Programme(props: {
    /** Include private drafts for signed-in team members. */
    isPlanningEnabled?: boolean;
    seriesId?: string;
    /** Offer a month view on the main Events page. */
    isCalendarEnabled?: boolean;
    /** Events to filter and paginate. */
    entries: CalendarEntry[];
    /** Maximum listings before linking to the full programme. */
    limit?: number;
    /** Heading level within the containing page. */
    heading?: "h1" | "h2";
    /** Series available as calendar filters. */
    series: { _id: string; slug: string; name: string }[];
}) {
    // retain the selected filters and visible event count
    const [params, setParams] = useSearchParams();
    const [series, setSeries] = createSignal("all");
    const [visibleCount, setVisibleCount] = createSignal(pageSize);
    const now = Date.now();
    const compare = (left: CalendarEntry, right: CalendarEntry) => right.startsAt - left.startsAt;
    const planning = usePlanning(() => !!props.isPlanningEnabled);
    const entries = () =>
        [...props.entries, ...(planning.current()?.entries ?? [])].filter(
            (event) => !props.seriesId || event.seriesId === props.seriesId,
        );
    useConfirmationRefresh(
        () => props.entries.some((event) => event.status === "scheduled" && isTentative(event)),
        () => revalidate(getCalendar.key),
    );
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
        const recent = [...entries()].sort(compare).slice(0, props.limit);

        return props.series.filter((item) => recent.some((event) => event.seriesId === item._id));
    });

    // filter one catalogue and show events in reverse chronological order
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
                    (isPreview() || !params.tag || event.tags.includes(String(params.tag))) &&
                    (series() === "all" || event.seriesId === series()),
            )
            .sort(compare),
    );

    // restart pagination only for filters, keeping background refreshes in place
    createEffect(
        on([series, period, year, isCalendar, () => params.tag], () => setVisibleCount(pageSize)),
    );

    return (
        <Card
            class={isPreview() ? "programme" : "programme programme--full"}
            heading={props.heading}
            meta={
                isPreview()
                    ? `${Math.min(props.limit!, matches().length)} of ${matches().length}`
                    : undefined
            }
            toolbar={
                <div class="row-actions">
                    <a class="button" href="/series">
                        Series
                    </a>
                    <Show when={planning.canCreate(props.seriesId)}>
                        <a
                            class="button"
                            href={props.seriesId ? `/submit?series=${props.seriesId}` : "/submit"}
                        >
                            New event
                        </a>
                    </Show>
                    <Show when={props.isCalendarEnabled}>
                        <FilterPills
                            label="Event view"
                            value={isCalendar() ? "calendar" : "list"}
                            options={[
                                { value: "list", label: "List" },
                                { value: "calendar", label: "Calendar" },
                            ]}
                            onChange={(view) =>
                                setParams({
                                    view: view === "list" ? undefined : view,
                                    period: undefined,
                                    year: undefined,
                                })
                            }
                        />
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
            {/* combine time and series filters over one chronological list */}
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
                <Show when={!props.seriesId}>
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
                <Show when={!isPreview() && !isCalendar()}>
                    <FilterPills
                        label="Event year"
                        value={year()}
                        options={years().map((value) => ({ value, label: value }))}
                        onChange={(value) =>
                            setParams({ year: value === year() ? undefined : value })
                        }
                    />
                </Show>
            </div>
            <Show when={planning.error()}>
                <div class="programme-planning-error">
                    <span>Could not load planning events.</span>
                    <button class="button" onClick={() => void planning.retry()}>
                        Try again
                    </button>
                </div>
            </Show>
            <Show
                when={isCalendar()}
                fallback={
                    <>
                        {/* render the current page with venue and upcoming tags */}
                        <ol class="event-list">
                            <For each={matches().slice(0, props.limit ?? visibleCount())}>
                                {(event, index) => (
                                    <li>
                                        {/* mark the transition from upcoming events into the archive */}
                                        <Show
                                            when={
                                                period() === "all" &&
                                                (year() === "all" || year() === eventYear(now)) &&
                                                event.startsAt < now &&
                                                (index() === 0 ||
                                                    matches()[index() - 1].startsAt >= now)
                                            }
                                        >
                                            <div class="programme-today">
                                                <span>Today</span>
                                            </div>
                                        </Show>
                                        <EventEntry
                                            event={event}
                                            now={now}
                                            series={
                                                props.seriesId
                                                    ? undefined
                                                    : props.series.find(
                                                          (series) => series._id === event.seriesId,
                                                      )
                                            }
                                            actions={
                                                <Show when={planning.canEdit(event.id)}>
                                                    <a
                                                        class="button"
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
                                            }
                                        />
                                    </li>
                                )}
                            </For>
                        </ol>
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
