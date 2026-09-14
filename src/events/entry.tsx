import { Highlight } from "../components/highlight";
import { Organisers } from "./organiser";
import { EventCounts } from "./counts";
import { EventBadges, EventTags } from "./tags";
import { isTentative } from "../../convex/events/conditions";
import type { CalendarEntry } from "./queries";
import "./entry.css";
import { timeZone } from "../app/site";

import { Show, type JSX } from "solid-js";
import { Arrow } from "../components/arrow";
import { isCurrentYear } from "./time";

/** Zurich calendar fields shared by event and news entries. */
const dateFormats = {
    day: new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric" }),
    month: new Intl.DateTimeFormat("en-GB", { timeZone, month: "short" }),
    year: new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric" }),
};

/** Render one dated event or news link on the shared entry grid. */
export function Entry(props: {
    /** Entry destination. */
    href: string;
    /** Team controls kept outside the public link. */
    actions?: JSX.Element;
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
    // format each date with shared Zurich calendar formatters
    const part = (field: "day" | "month" | "year") => dateFormats[field].format(props.date);

    return (
        <div class="entry-container">
            <div
                class={`entry ${props.class ?? ""}`}
                classList={{ "entry-publication": props.datePlacement === "below" }}
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
                <div class="entry-title-row">
                    <a class="event-title" href={props.href}>
                        {props.title}
                    </a>
                    <div class="entry-actions">{props.actions}</div>
                </div>
                <span class="event-description">{props.description}</span>
                <div class="event-venue">{props.meta}</div>
                <Show when={props.datePlacement === "below"}>
                    <a class="event-arrow" href={props.href} aria-label="Read article">
                        <Arrow />
                    </a>
                </Show>
            </div>
        </div>
    );
}

/** Keep event metadata and publication labels identical across programmes and series. */
export function EventEntry(props: {
    event: CalendarEntry;
    description?: string;
    terms?: readonly string[];
    now: number;
    actions?: JSX.Element;
    series?: { slug: string; name: string };
}) {
    return (
        <Entry
            href={props.event.href}
            date={props.event.startsAt}
            title={<Highlight text={props.event.title} terms={props.terms ?? []} />}
            description={
                <Highlight
                    text={props.description ?? props.event.summary ?? ""}
                    terms={props.terms ?? []}
                />
            }
            class={props.event.startsAt < props.now ? "event-row event-row-past" : "event-row"}
            actions={props.actions}
            meta={
                <>
                    <div class="entry-tags">
                        <Show
                            when={
                                props.event.status === "scheduled" &&
                                props.event.startsAt > props.now
                            }
                        >
                            <span class="tag tag-upcoming">
                                {isTentative(props.event) ? "Tentative" : "Upcoming"}
                            </span>
                        </Show>
                        <Show when={props.event.status === "cancelled"}>
                            <span class="tag">Cancelled</span>
                        </Show>
                        <Show when={props.event.status === "draft"}>
                            <span class="tag">Draft</span>
                        </Show>
                        <EventBadges
                            isPartner={props.event.isPartner}
                            registrationKind={props.event.registrationKind}
                        />
                        <EventTags series={props.series} />
                        <Show when={props.event.location}>
                            <span class="tag">{props.event.location}</span>
                        </Show>
                    </div>
                    <div class="entry-people">
                        <EventCounts
                            compact
                            confirmed={props.event.rsvpCount}
                            waitlist={props.event.waitlistCount}
                        />
                        <Organisers
                            compact
                            primary={props.event.organiser}
                            others={props.event.coOrganisers}
                            href={props.event.href}
                        />
                    </div>
                </>
            }
        />
    );
}
