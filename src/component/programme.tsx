import { pageSize } from "../core/constants";
import { type CalendarEntry } from "../core/queries";

import { Card } from "./card";
import { FilterPills } from "./filter-pills";
import { Entry } from "./entry";
import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";

/** Browse events in a single aligned calendar, filtered by period, year and series. */
export function Programme(props: {
    /** Published events to filter and paginate. */
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
    const isPreview = () => props.limit !== undefined;
    const period = () => (isPreview() ? "all" : (params.period ?? "all"));

    const year = () => (!isPreview() && typeof params.year === "string" ? params.year : "all");
    const yearFormat = new Intl.DateTimeFormat("en", {
        year: "numeric",
        timeZone: "Europe/Zurich",
    });
    const eventYear = (startsAt: number) => yearFormat.format(startsAt);
    const years = createMemo(() =>
        [...new Set(props.entries.map((event) => eventYear(event.startsAt)))].sort(),
    );

    // keep homepage series filters relevant to the unfiltered preview
    const availableSeries = createMemo(() => {
        if (!isPreview()) return props.series;
        const recent = [...props.entries]
            .sort((a, b) => b.startsAt - a.startsAt)
            .slice(0, props.limit);

        return props.series.filter((item) => recent.some((event) => event.seriesId === item._id));
    });

    // filter one catalogue and order it by the selected period
    const matches = createMemo(() =>
        props.entries
            .filter(
                (event) =>
                    (period() === "all" ||
                        (period() === "past" ? event.startsAt < now : event.startsAt >= now)) &&
                    (year() === "all" || eventYear(event.startsAt) === year()) &&
                    (series() === "all" ||
                        event.seriesId === series() ||
                        event.tags.includes(series())),
            )
            .sort((a, b) =>
                period() === "upcoming" ? a.startsAt - b.startsAt : b.startsAt - a.startsAt,
            ),
    );

    // restart the visible page whenever the matching event set changes
    createEffect(on(matches, () => setVisibleCount(pageSize)));

    return (
        <Card
            class={isPreview() ? "programme" : "programme programme--full"}
            heading={props.heading}
            title={
                <Show when={props.heading !== "h1"} fallback="Events">
                    <a href="/events">Events</a>
                </Show>
            }
        >
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
                <FilterPills
                    label="Event series"
                    value={series()}
                    options={[
                        ...(isPreview() ? [{ value: "all", label: "All" }] : []),
                        ...availableSeries().map((item) => ({ value: item._id, label: item.name })),
                    ]}
                    onChange={(value) => setSeries(value === series() ? "all" : value)}
                />
                <Show when={!isPreview()}>
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
                                    (index() === 0 || matches()[index() - 1].startsAt >= now)
                                }
                            >
                                <div class="programme-today">
                                    <span>Today</span>
                                </div>
                            </Show>
                            <Entry
                                class={
                                    event.startsAt < now ? "event-row event-row-past" : "event-row"
                                }
                                href={event.href}
                                date={event.startsAt}
                                title={event.title}
                                description={event.summary}
                                meta={
                                    <>
                                        <span class="tag">
                                            {event.location}
                                            {event.status === "cancelled" ? " · Cancelled" : ""}
                                        </span>
                                        <Show
                                            when={
                                                event.status === "scheduled" && event.startsAt > now
                                            }
                                        >
                                            <span class="tag tag-upcoming">Upcoming</span>
                                        </Show>
                                    </>
                                }
                            />
                        </li>
                    )}
                </For>
            </ol>
            {/* reveal the next page without replacing existing entries */}
            <Show when={(props.limit ?? visibleCount()) < matches().length}>
                <div class="programme-more">
                    <Show
                        when={props.limit === undefined}
                        fallback={
                            <a class="button" href="/events">
                                All events
                            </a>
                        }
                    >
                        <button
                            class="button"
                            type="button"
                            onClick={() => setVisibleCount((count) => count + pageSize)}
                        >
                            Load more
                        </button>
                    </Show>
                    <span>
                        {Math.min(props.limit ?? visibleCount(), matches().length)} of{" "}
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
                          ? "No upcoming events published."
                          : "No events published."}
                </p>
            </Show>
        </Card>
    );
}
