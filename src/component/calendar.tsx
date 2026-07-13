import type { JSX } from "solid-js";
import { For, Show, createMemo, createSignal } from "solid-js";

import type { CalendarEntry } from "../data/public";
import { Section } from "./page";
import { TableToolbar } from "./toolbar";

/** Calendar, a legend box of dated event rows. */
export function Calendar(props: {
    actions?: JSX.Element;
    dividerAt?: number;
    empty?: JSX.Element;
    entries: CalendarEntry[];
    isSearchable?: boolean;
    meta?: string;
    titleHref?: string;
    title: string;
    view?: "compact" | "detailed";
}) {
    const [query, setQuery] = createSignal("");
    const entries = createMemo(() => {
        const normalized = query().trim().toLowerCase();

        // keep all rows before search begins
        if (normalized.length === 0) {
            return props.entries;
        }

        return props.entries.filter((entry) => eventText(entry).includes(normalized));
    });
    const count = () => {
        if (entries().length === props.entries.length) {
            return `${props.entries.length}`;
        }

        return `${entries().length} / ${props.entries.length}`;
    };
    const upcoming = createMemo(() => {
        const dividerAt = props.dividerAt;
        if (dividerAt === undefined) {
            return entries();
        }

        return entries()
            .filter((entry) => entry.startsAt >= dividerAt)
            .sort((left, right) => left.startsAt - right.startsAt);
    });
    const past = createMemo(() => {
        const dividerAt = props.dividerAt;
        if (dividerAt === undefined) {
            return [];
        }

        return entries()
            .filter((entry) => entry.startsAt < dividerAt)
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
                when={entries().length > 0}
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
                        {(entry) => <CalendarRow entry={entry} view={props.view ?? "detailed"} />}
                    </For>

                    {/* current date */}
                    <Show when={props.dividerAt}>
                        {(dividerAt) => <CalendarToday value={dividerAt()} />}
                    </Show>

                    {/* past rows */}
                    <For each={past()}>
                        {(entry) => <CalendarRow entry={entry} view={props.view ?? "detailed"} />}
                    </For>
                </ol>
            </Show>
        </Section>
    );
}

/** Searchable event text. */
function eventText(entry: CalendarEntry) {
    return [
        entry.title,
        entry.summary,
        entry.location,
        entry.seriesTitle,
        ...(entry.speakers ?? []),
    ]
        .filter((value) => value !== undefined)
        .join(" ")
        .toLowerCase();
}

/** Calendar row. */
function CalendarRow(props: { entry: CalendarEntry; view: "compact" | "detailed" }) {
    return (
        <li class="calendar-row">
            <a
                data-row
                class="calendar-row__link"
                href={props.entry.href ?? `/events/${props.entry.slug}`}
            >
                {/* marker */}
                <span class="calendar-row__marker">{">"}</span>

                {/* date */}
                <time
                    class="calendar-row__date"
                    dateTime={new Date(props.entry.startsAt).toISOString()}
                >
                    {formatDate(props.entry.startsAt)}
                </time>

                {/* event */}
                <span class="calendar-row__event">
                    <strong>{props.entry.title}</strong>
                    <Show when={props.view === "detailed" && props.entry.summary}>
                        <span class="calendar-row__summary">{props.entry.summary}</span>
                    </Show>
                    <Show when={metaLine(props.entry)}>
                        <span class="calendar-row__meta">{metaLine(props.entry)}</span>
                    </Show>
                </span>

                {/* venue and gauge */}
                <span class="calendar-row__venue">
                    <span>{props.entry.location}</span>
                    <Show when={gaugeLine(props.entry)}>
                        <span>
                            <span class="calendar-row__gauge">{gaugeBlocks(props.entry)}</span>{" "}
                            {gaugeLine(props.entry)}
                        </span>
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
