import { A } from "@solidjs/router";
import type { JSX } from "solid-js";
import { For, Show } from "solid-js";

import type { CalendarEntry } from "../data/public";
import { Section } from "./page";

/** Calendar, a legend box of dated event rows. */
export function Calendar(props: {
    entries: CalendarEntry[];
    meta?: string;
    more?: { href: string; label: string };
    title: string;
}) {
    return (
        <Section title={props.title} meta={props.meta}>
            {/* empty */}
            <Show when={props.entries.length > 0} fallback={<p class="text-soft">nothing yet.</p>}>
                {/* rows */}
                <ol class="grid">
                    <For each={props.entries}>{(entry) => <CalendarRow entry={entry} />}</For>
                </ol>
            </Show>

            {/* trailing link row */}
            <Show when={props.more}>
                {(more) => (
                    <a
                        class="-mx-2 block border-t border-line px-2 pt-2 pb-0.5 text-xs text-soft underline underline-offset-3 hover:text-ink"
                        href={more().href}
                    >
                        {more().label}
                    </a>
                )}
            </Show>
        </Section>
    );
}

/** Calendar row: caret gutter, date, event, venue and gauge. */
function CalendarRow(props: { entry: CalendarEntry }) {
    return (
        <li class="-mx-2 border-b border-line last:border-b-0">
            <a
                data-row
                class="group grid grid-cols-[16px_104px_1fr] items-start gap-2 px-2 py-2 outline-none focus:bg-ink hover:bg-ink md:grid-cols-[16px_104px_1fr_144px]"
                href={props.entry.href ?? `/events/${props.entry.slug}`}
            >
                {/* caret */}
                <span class="text-transparent group-focus:text-paper group-hover:text-paper">
                    {">"}
                </span>

                {/* date */}
                <span class="text-xs leading-[21px] whitespace-nowrap text-soft tabular-nums group-focus:text-paper/60 group-hover:text-paper/60">
                    {formatDate(props.entry.startsAt)}
                </span>

                {/* title, summary, product meta */}
                <span class="grid gap-0.5">
                    <span class="font-medium group-focus:text-paper group-hover:text-paper">
                        {props.entry.title}
                    </span>
                    <Show when={props.entry.summary}>
                        <span class="text-[13px] text-soft group-focus:text-paper/60 group-hover:text-paper/60">
                            {props.entry.summary}
                        </span>
                    </Show>
                    <Show when={metaLine(props.entry)}>
                        <span class="text-xs text-soft group-focus:text-paper/60 group-hover:text-paper/60">
                            {metaLine(props.entry)}
                        </span>
                    </Show>
                </span>

                {/* venue and gauge */}
                <span class="hidden text-right text-xs leading-[21px] lowercase text-soft group-focus:text-paper/60 group-hover:text-paper/60 md:grid md:gap-0.5">
                    <span class="truncate">{props.entry.location}</span>
                    <Show when={gaugeLine(props.entry)}>
                        <span class="whitespace-nowrap">
                            <span class="-tracking-widest text-ink group-focus:text-paper group-hover:text-paper">
                                {gaugeBlocks(props.entry)}
                            </span>{" "}
                            {gaugeLine(props.entry)}
                        </span>
                    </Show>
                </span>
            </a>
        </li>
    );
}

/** Build the row's product meta line: activation, series, cadence, speakers. */
function metaLine(entry: CalendarEntry): string | undefined {
    const parts: string[] = [];

    // conditional activation first, it decides whether the event happens
    if (entry.activation !== undefined) {
        const deadline = formatDay(entry.activation.deadlineAt);
        parts.push(`[conditional] happens at ${entry.activation.threshold} rsvps by ${deadline}`);
    }

    // series membership and cadence
    if (entry.seriesTitle !== undefined) {
        const series = [`↻ ${entry.seriesTitle}`, entry.cadence];
        if (entry.seriesNextAt !== undefined) {
            series.push(`next ${formatDay(entry.seriesNextAt)}`);
        }
        parts.push(series.filter(Boolean).join(" · "));
    }

    // speakers
    if (entry.speakers !== undefined && entry.speakers.length > 0) {
        parts.push(`w/ ${entry.speakers.join(", ")}`);
    }

    return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** Text-block RSVP gauge like "███░░". */
function gaugeBlocks(entry: CalendarEntry): string | undefined {
    if (entry.rsvpCount === undefined || entry.capacity === undefined || entry.capacity === 0) {
        return undefined;
    }

    const filled = Math.max(0, Math.min(5, Math.round((5 * entry.rsvpCount) / entry.capacity)));

    return "█".repeat(filled) + "░".repeat(5 - filled);
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

/** Format a calendar date like "09 jul 18:30". */
export function formatDate(value: number): string {
    return new Intl.DateTimeFormat("en-CH", {
        day: "2-digit",
        month: "short",
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
