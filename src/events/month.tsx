import { useAccess } from "../auth/edit";
import { isTentative } from "../../convex/events/conditions";
import { createMemo, createSignal, For, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { Arrow } from "../components/arrow";
import { civilTime } from "./time";
import type { CalendarEntry } from "./queries";
import "./month.css";

/** Browse a month in Zurich time, with a compact day agenda on phones. */
export function EventCalendar(props: { entries: CalendarEntry[] }) {
    const [params, setParams] = useSearchParams();
    const today = civilTime(Date.now()).slice(0, 10);
    const [chosen, setChosen] = createSignal(today);
    const month = () =>
        typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month)
            ? params.month
            : today.slice(0, 7);
    const first = () => new Date(`${month()}-01T12:00:00Z`);
    const label = () =>
        first().toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    const fullDate = (day: string) =>
        new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
        });
    const selected = () => (chosen().startsWith(month()) ? chosen() : `${month()}-01`);
    const byDay = createMemo(() => {
        const days = new Map<string, CalendarEntry[]>();
        for (const event of [...props.entries].sort((a, b) => a.startsAt - b.startsAt)) {
            const day = civilTime(event.startsAt).slice(0, 10);
            days.set(day, [...(days.get(day) ?? []), event]);
        }
        return days;
    });
    const days = createMemo(() => {
        const start = first();
        const offset = (start.getUTCDay() + 6) % 7;
        const count = new Date(
            Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
        ).getUTCDate();
        return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
            const date = new Date(start);
            date.setUTCDate(index - offset + 1);
            return date.toISOString().slice(0, 10);
        });
    });

    /** Navigate months without discarding series or draft filters. */
    function move(offset: number) {
        const date = first();
        date.setUTCMonth(date.getUTCMonth() + offset);
        setParams({ month: date.toISOString().slice(0, 7) });
    }

    return (
        <div class="event-calendar">
            <div class="calendar-toolbar">
                <h2 aria-live="polite">{label()}</h2>
                <div class="row-actions">
                    <button
                        class="button"
                        onClick={() => {
                            setChosen(today);
                            setParams({ month: undefined });
                        }}
                    >
                        Today
                    </button>
                    <button
                        class="button calendar-arrow"
                        aria-label="Previous month"
                        onClick={() => move(-1)}
                    >
                        <Arrow direction="left" />
                    </button>
                    <button
                        class="button calendar-arrow"
                        aria-label="Next month"
                        onClick={() => move(1)}
                    >
                        <Arrow />
                    </button>
                </div>
            </div>
            <div class="calendar-weekdays" aria-hidden="true">
                <For each={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}>
                    {(day) => <span>{day}</span>}
                </For>
            </div>
            <div class="calendar-grid">
                <For each={days()}>
                    {(day) => (
                        <div
                            class="calendar-day"
                            classList={{
                                "is-outside": !day.startsWith(month()),
                                "is-today": day === today,
                                "is-selected": day === selected(),
                            }}
                        >
                            <button
                                class="calendar-date"
                                aria-label={`${fullDate(day)}, ${byDay().get(day)?.length ?? 0} ${byDay().get(day)?.length === 1 ? "event" : "events"}`}
                                aria-current={day === today ? "date" : undefined}
                                aria-pressed={day === selected()}
                                onClick={() => {
                                    setChosen(day);
                                    if (!day.startsWith(month()))
                                        setParams({ month: day.slice(0, 7) });
                                }}
                            >
                                {Number(day.slice(-2))}
                                <span class="calendar-dots" aria-hidden="true">
                                    <For each={(byDay().get(day) ?? []).slice(0, 3)}>
                                        {(event) => (
                                            <i
                                                classList={{ "is-draft": event.status === "draft" }}
                                            />
                                        )}
                                    </For>
                                </span>
                            </button>
                            <div class="calendar-events">
                                <For each={byDay().get(day)}>
                                    {(event) => <CalendarEvent event={event} />}
                                </For>
                            </div>
                        </div>
                    )}
                </For>
            </div>
            <section class="calendar-agenda" aria-label="Selected day">
                <h3>{fullDate(selected())}</h3>
                <For each={byDay().get(selected())} fallback={<p class="text-soft">No events.</p>}>
                    {(event) => <CalendarEvent event={event} />}
                </For>
            </section>
        </div>
    );
}

/** Keep event links and publication labels identical in the grid and day agenda. */
function CalendarEvent(props: { event: CalendarEntry }) {
    const access = useAccess();
    return (
        <div>
            <a
                class="calendar-event"
                classList={{
                    "is-draft": props.event.status === "draft",
                    "is-cancelled": props.event.status === "cancelled",
                }}
                href={props.event.href}
            >
                <time>{civilTime(props.event.startsAt).slice(11, 16)}</time>
                <strong>{props.event.title}</strong>
                <Show
                    when={
                        props.event.status === "draft" ||
                        props.event.status === "cancelled" ||
                        isTentative(props.event)
                    }
                >
                    <span class="calendar-status">
                        {props.event.status === "draft"
                            ? "Draft"
                            : props.event.status === "cancelled"
                              ? "Cancelled"
                              : "Tentative"}
                    </span>
                </Show>
            </a>
            <Show when={access.canEvent(props.event.id)}>
                <a
                    class="calendar-edit"
                    aria-label={`Edit ${props.event.title}`}
                    href={
                        props.event.status === "draft"
                            ? props.event.href
                            : `/submit?event=${props.event.id}`
                    }
                >
                    Edit
                </a>
            </Show>
        </div>
    );
}
