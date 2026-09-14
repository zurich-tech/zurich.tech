import { For, Show, type JSX } from "solid-js";
import { EventEntry } from "./entry";
import type { CalendarEntry } from "./queries";

/** Render the same timeline, metadata and row spacing wherever events are listed. */
export function EventList<T extends CalendarEntry>(props: {
    events: T[];
    series: { _id: string; slug: string; name: string }[];
    now: number;
    terms?: readonly string[];
    excerpts?: Record<string, string>;
    showToday?: boolean;
    actions?: (event: T) => JSX.Element;
}) {
    return (
        <ol class="event-list">
            <For each={props.events}>
                {(event, index) => (
                    <li>
                        <Show
                            when={
                                props.showToday &&
                                index() > 0 &&
                                event.startsAt < props.now &&
                                props.events[index() - 1].startsAt >= props.now
                            }
                        >
                            <div class="programme-today">
                                <span>Today</span>
                            </div>
                        </Show>
                        <EventEntry
                            event={event}
                            terms={props.terms}
                            description={props.excerpts?.[event.href]}
                            now={props.now}
                            series={props.series.find((series) => series._id === event.seriesId)}
                            actions={props.actions?.(event)}
                        />
                    </li>
                )}
            </For>
        </ol>
    );
}
