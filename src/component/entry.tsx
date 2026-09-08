import { timeZone } from "../core/constants";

import { Show, type JSX } from "solid-js";
import { Arrow } from "./arrow";
import { isCurrentYear } from "../core/time";

/** Zürich calendar fields shared by event and news entries. */
const dateFormats = {
    day: new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric" }),
    month: new Intl.DateTimeFormat("en-GB", { timeZone, month: "short" }),
    year: new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric" }),
};

/** Render one dated event or news link on the shared entry grid. */
export function Entry(props: {
    /** Entry destination. */
    href: string;
    /** Event start or article publication time. */
    date: number;
    /** Put publication dates below news copy instead of in the event date column. */
    datePlacement?: "side" | "below";
    /** Primary linked title. */
    title: JSX.Element;
    /** Supporting description. */
    description?: JSX.Element;
    /** Optional venue or author. */
    meta?: JSX.Element;
    /** Distinguish event and news rows where needed. */
    class?: string;
}) {
    // format each date with shared Zürich calendar formatters
    const part = (field: "day" | "month" | "year") => dateFormats[field].format(props.date);

    return (
        <a
            class={`entry ${props.class ?? ""}`}
            classList={{ "entry-publication": props.datePlacement === "below" }}
            href={props.href}
        >
            {/* place news dates below copy and event dates in the left column */}
            <Show
                when={props.datePlacement !== "below"}
                fallback={
                    <time class="entry-published" dateTime={new Date(props.date).toISOString()}>
                        {part("day")} {part("month")}
                        {isCurrentYear(props.date) ? "" : ` ${part("year")}`}
                    </time>
                }
            >
                <time class="event-date" dateTime={new Date(props.date).toISOString()}>
                    <span class="event-day">{part("day")}</span>
                    <span class="event-date-details">
                        <span class="event-month">{part("month")}</span>
                        <Show when={!isCurrentYear(props.date)}>
                            <span class="event-year">{part("year")}</span>
                        </Show>
                    </span>
                </time>{" "}
            </Show>

            {/* align linked titles, descriptions and metadata across entries */}
            <strong class="event-title">{props.title}</strong>
            <span class="event-description">{props.description}</span>
            <span class="event-venue">{props.meta}</span>
            <span class="event-arrow" aria-hidden="true">
                <Arrow />
            </span>
        </a>
    );
}
