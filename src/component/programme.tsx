import { pageSize } from "../core/constants";
import { type CalendarEntry } from "../core/queries";

import { Arrow } from "./arrow";
import { Card } from "./card";
import { Entry } from "./entry";
import { createSignal, createMemo, createEffect, on, For, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";

/** Browse events in a single aligned calendar, filtered by period, series, and registration destination. */
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
    const [registration, setRegistration] = createSignal("all");
    const now = Date.now();
    const period = () => params.period ?? "all";

    // filter one catalogue and order it by the selected period
    const matches = createMemo(() =>
        props.entries
            .filter(
                (event) =>
                    (period() === "all" ||
                        (period() === "past" ? event.startsAt < now : event.startsAt >= now)) &&
                    (registration() === "all" ||
                        (registration() === "external"
                            ? event.registrationKind === "external"
                            : event.registrationKind !== "external")) &&
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
            class="programme"
            heading={props.heading}
            title={
                <>
                    <Show when={props.heading !== "h1"} fallback="Events">
                        <a href="/events">Events</a>
                    </Show>{" "}
                    <span class="programme-count">{matches().length}</span>
                </>
            }
        >
            {/* combine time and series filters over one chronological list */}
            <div class="programme-tagbar" aria-label="Filter events">
                <div class="programme-tags" role="group" aria-label="Event period">
                    <For
                        each={[
                            { value: "all", label: "All" },
                            { value: "upcoming", label: "Upcoming" },
                            { value: "past", label: "Past" },
                        ]}
                    >
                        {(item) => (
                            <button
                                type="button"
                                aria-pressed={period() === item.value}
                                classList={{ selected: period() === item.value }}
                                onClick={() =>
                                    setParams({
                                        period: item.value === "all" ? undefined : item.value,
                                    })
                                }
                            >
                                {item.label}
                            </button>
                        )}
                    </For>
                </div>
                <div class="programme-tags" role="group" aria-label="Event series">
                    <For each={props.series}>
                        {(item) => (
                            <button
                                type="button"
                                aria-pressed={series() === item._id}
                                classList={{ selected: series() === item._id }}
                                onClick={() => setSeries(series() === item._id ? "all" : item._id)}
                            >
                                {item.name}
                            </button>
                        )}
                    </For>
                </div>
                <div class="programme-tags" role="group" aria-label="Registration location">
                    <For each={["Internal", "External"]}>
                        {(label) => (
                            <button
                                type="button"
                                aria-pressed={registration() === label.toLowerCase()}
                                classList={{ selected: registration() === label.toLowerCase() }}
                                onClick={() =>
                                    setRegistration(
                                        registration() === label.toLowerCase()
                                            ? "all"
                                            : label.toLowerCase(),
                                    )
                                }
                            >
                                {label}
                            </button>
                        )}
                    </For>
                </div>
            </div>
            {/* render the current page with venue and registration tags */}
            <ol class="event-list">
                <For each={matches().slice(0, props.limit ?? visibleCount())}>
                    {(event) => (
                        <li>
                            <Entry
                                class="event-row"
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
                                        <Show when={event.registrationKind === "external"}>
                                            <span class="tag tag-external">
                                                External <Arrow direction="external" />
                                            </span>
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
                    {series() !== "all" || registration() !== "all"
                        ? "No events match these filters."
                        : period() === "upcoming"
                          ? "No upcoming events published."
                          : "No events published."}
                </p>
            </Show>
        </Card>
    );
}
