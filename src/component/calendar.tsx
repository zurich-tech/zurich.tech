import type { JSX } from "solid-js";
import { For, Show, createMemo, createSignal } from "solid-js";

import type { CalendarEntry } from "../data/public";
import { matchesSearch, searchTerms } from "../search";
import { Highlight } from "./highlight";
import { Section } from "./page";
import { TableToolbar } from "./toolbar";

/** Calendar presentation and search properties. */
type CalendarProps = {
    /** Commands shown beside search. */
    actions?: JSX.Element;
    /** The instant separating upcoming and past events. */
    dividerAt: number;
    /** Content shown when the calendar is empty. */
    empty?: JSX.Element;
    /** Every event available to display and search. */
    entries: CalendarEntry[];
    /** Whether event search is available. */
    isSearchable?: boolean;
    /** The maximum event count before search begins. */
    limit?: number;
    /** Text shown beside the section title. */
    meta?: string;
    /** The section title. */
    title: string;
    /** The section title destination. */
    titleHref?: string;
};

/** Dated event calendar. */
export function Calendar(props: CalendarProps) {
    const [query, setQuery] = createSignal("");
    const terms = createMemo(() => searchTerms(query()));

    // search the complete supplied calendar
    const matches = createMemo(() => {
        // keep all rows before search begins
        if (terms().length === 0) {
            return props.entries;
        }

        return props.entries.filter((entry) =>
            matchesSearch(eventText(entry, props.dividerAt), terms()),
        );
    });

    // order every match around the current date
    const ordered = createMemo(() => {
        const upcoming = matches()
            .filter((entry) => entry.startsAt >= props.dividerAt)
            .sort((left, right) => left.startsAt - right.startsAt);
        const past = matches()
            .filter((entry) => entry.startsAt < props.dividerAt)
            .sort((left, right) => right.startsAt - left.startsAt);

        return [...upcoming, ...past];
    });

    // limit only the default view, never search results
    const entries = createMemo(() => {
        if (terms().length > 0 || props.limit === undefined) {
            return ordered();
        }

        return ordered().slice(0, props.limit);
    });
    const count = () => {
        if (terms().length > 0 && matches().length !== props.entries.length) {
            return `${matches().length} / ${props.entries.length}`;
        }

        return `${props.entries.length}`;
    };
    const upcoming = createMemo(() => {
        return entries()
            .filter((entry) => entry.startsAt >= props.dividerAt)
            .sort((left, right) => left.startsAt - right.startsAt);
    });
    const past = createMemo(() => {
        return entries()
            .filter((entry) => entry.startsAt < props.dividerAt)
            .sort((left, right) => right.startsAt - left.startsAt);
    });

    return (
        <Section
            href={props.titleHref}
            meta={props.meta ?? count()}
            title={props.title}
            toolbar={
                props.isSearchable !== false || props.actions !== undefined ? (
                    <TableToolbar
                        actions={props.actions}
                        onSearch={props.isSearchable === false ? undefined : setQuery}
                        placeholder="search events..."
                    />
                ) : undefined
            }
        >
            {/* empty */}
            <Show
                when={matches().length > 0}
                fallback={
                    query().length > 0 ? (
                        <p class="calendar-empty">no matches</p>
                    ) : (
                        (props.empty ?? <p class="calendar-empty">none</p>)
                    )
                }
            >
                {/* rows */}
                <ol class="calendar">
                    <For each={upcoming()}>
                        {(entry) => (
                            <CalendarRow
                                entry={entry}
                                isSearching={terms().length > 0}
                                now={props.dividerAt}
                                terms={terms()}
                            />
                        )}
                    </For>

                    {/* current date */}
                    <CalendarToday value={props.dividerAt} />

                    {/* past rows */}
                    <For each={past()}>
                        {(entry) => (
                            <CalendarRow
                                entry={entry}
                                isSearching={terms().length > 0}
                                now={props.dividerAt}
                                terms={terms()}
                            />
                        )}
                    </For>
                </ol>
            </Show>
        </Section>
    );
}

/** Searchable event text. */
function eventText(entry: CalendarEntry, now: number) {
    return [
        entry.title,
        entry.summary,
        entry.location,
        entry.seriesTitle,
        formatDate(entry.startsAt),
        metaLine(entry),
        gaugeLine(entry),
        ...eventTags(entry, now),
        ...(entry.speakers ?? []),
    ]
        .filter((value) => value !== undefined)
        .join(" ");
}

/** Calendar row. */
function CalendarRow(props: {
    entry: CalendarEntry;
    isSearching: boolean;
    now: number;
    terms: readonly string[];
}) {
    const meta = () => metaLine(props.entry);
    const gauge = () => gaugeLine(props.entry);
    const tags = () => eventTags(props.entry, props.now);

    return (
        <li class="calendar-row" classList={{ "calendar-row--searching": props.isSearching }}>
            <a
                data-row
                class="calendar-row__link"
                href={props.entry.href ?? `/events/${props.entry.slug}`}
            >
                {/* date */}
                <time
                    class="calendar-row__date"
                    dateTime={new Date(props.entry.startsAt).toISOString()}
                >
                    <Highlight text={formatDate(props.entry.startsAt)} terms={props.terms} />
                </time>

                {/* event */}
                <span class="calendar-row__event">
                    <strong>
                        <Highlight text={props.entry.title} terms={props.terms} />
                    </strong>
                    <Show when={props.entry.summary}>
                        {(summary) => (
                            <span class="calendar-row__summary">
                                <Highlight text={summary()} terms={props.terms} />
                            </span>
                        )}
                    </Show>
                    <Show when={meta()}>
                        {(value) => (
                            <span class="calendar-row__meta">
                                <Highlight text={value()} terms={props.terms} />
                            </span>
                        )}
                    </Show>

                    {/* tags */}
                    <Show when={tags().length > 0}>
                        <span class="calendar-row__tags">
                            <For each={tags()}>
                                {(tag) => (
                                    <span>
                                        #<Highlight text={tag} terms={props.terms} />
                                    </span>
                                )}
                            </For>
                        </span>
                    </Show>
                </span>

                {/* venue and gauge */}
                <span class="calendar-row__venue">
                    <Show when={props.entry.location}>
                        {(location) => (
                            <span>
                                <Highlight text={location()} terms={props.terms} />
                            </span>
                        )}
                    </Show>
                    <Show when={gauge()}>
                        {(value) => (
                            <span>
                                <span class="calendar-row__gauge">{gaugeBlocks(props.entry)}</span>{" "}
                                <Highlight text={value()} terms={props.terms} />
                            </span>
                        )}
                    </Show>
                </span>
            </a>
        </li>
    );
}

/** Current date dividing future and past events. */
function CalendarToday(props: { value: number }) {
    return (
        <li class="calendar-today">
            <time dateTime={new Date(props.value).toISOString()}>
                today / {formatCivilDate(props.value)}
            </time>
        </li>
    );
}

/** Add the current period to one calendar entry's stable tags. */
function eventTags(entry: CalendarEntry, now: number): string[] {
    const period = entry.startsAt >= now ? "upcoming" : "past";

    return [...new Set([period, ...entry.tags])];
}

/** Build the row's product meta line: activation, series, cadence, speakers. */
function metaLine(entry: CalendarEntry): string | undefined {
    const parts: string[] = [];

    // conditional activation first, it decides whether the event happens
    if (entry.activation !== undefined) {
        const deadline = formatDay(entry.activation.deadlineAt);
        parts.push(`[conditional] minimum ${entry.activation.threshold} rsvps by ${deadline}`);
    }

    // series membership and cadence
    if (entry.seriesTitle !== undefined) {
        const series = [`series: ${entry.seriesTitle}`, entry.cadence];
        if (entry.seriesNextAt !== undefined) {
            series.push(`next ${formatDay(entry.seriesNextAt)}`);
        }
        parts.push(series.filter(Boolean).join(" / "));
    }

    // speakers
    if (entry.speakers !== undefined && entry.speakers.length > 0) {
        parts.push(`speakers: ${entry.speakers.join(", ")}`);
    }

    return parts.length > 0 ? parts.join(" / ") : undefined;
}

/** Text RSVP gauge like "[###--]". */
function gaugeBlocks(entry: CalendarEntry): string | undefined {
    if (entry.rsvpCount === undefined || entry.capacity === undefined || entry.capacity === 0) {
        return undefined;
    }

    const filled = Math.max(0, Math.min(5, Math.round((5 * entry.rsvpCount) / entry.capacity)));

    return `[${"#".repeat(filled)}${"-".repeat(5 - filled)}]`;
}

/** Gauge caption: "47/80" upcoming, "61 attended" past. */
function gaugeLine(entry: CalendarEntry): string | undefined {
    if (entry.attendedCount !== undefined) {
        return `${entry.attendedCount} attended`;
    }
    if (entry.rsvpCount === undefined) {
        return undefined;
    }
    if (entry.capacity === undefined) {
        return `${entry.rsvpCount} going`;
    }

    return `${entry.rsvpCount}/${entry.capacity}`;
}

/** Format a calendar date like "09 jul 2026 18:30". */
export function formatDate(value: number): string {
    return new Intl.DateTimeFormat("en-CH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Zurich",
    })
        .format(value)
        .replace(",", "")
        .toLowerCase();
}

/** Format a day like "09 jul". */
export function formatDay(value: number): string {
    return new Intl.DateTimeFormat("en-CH", {
        day: "2-digit",
        month: "short",
        timeZone: "Europe/Zurich",
    })
        .format(value)
        .toLowerCase();
}

/** Format a civil date like "12 jul 2026". */
function formatCivilDate(value: number): string {
    return new Intl.DateTimeFormat("en-CH", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Zurich",
    })
        .format(value)
        .toLowerCase();
}
