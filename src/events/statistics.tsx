import { For, Show } from "solid-js";
import type { PublicEvent, CalendarEntry } from "./queries";
import "./statistics.css";
import { site } from "../app/site";

/** A consistent, labelled row of public event or series totals. */
export function Statistics(props: { items: { label: string; value: number | string }[] }) {
    return (
        <dl class="statistics event-statistics">
            <For each={props.items}>
                {(item) => (
                    <div>
                        <dt>{item.label}</dt>
                        <dd>
                            {typeof item.value === "number"
                                ? item.value.toLocaleString("en-CH")
                                : item.value}
                        </dd>
                    </div>
                )}
            </For>
        </dl>
    );
}

/** Show known registration totals, keeping small totals visible to organisers only. */
export function RegistrationStatistics(props: { event: PublicEvent; isOrganiser: boolean }) {
    const items = () => {
        const event = props.event;
        const values: { label: string; value: number | string }[] = [];

        // organisers see every known total, the public only established ones
        const isPublic = event.rsvpCount >= site.publicRegistrations;
        if (
            props.isOrganiser
                ? event.registration.kind === "native" || event.rsvpCount > 0
                : isPublic
        )
            values.push({ label: "Registered", value: event.rsvpCount });
        if (
            props.isOrganiser
                ? (event.registration.kind === "native" &&
                      event.registration.overflow === "waitlist") ||
                  event.waitlistCount > 0
                : isPublic && event.waitlistCount > 0
        )
            values.push({ label: "Waitlist", value: event.waitlistCount });

        return values;
    };
    return (
        <Show when={items().length}>
            <Statistics items={items()} />
        </Show>
    );
}

/** Count public occurrences; cancelled events are neither held nor upcoming. */
export function SeriesStatistics(props: { events: CalendarEntry[]; now: number }) {
    const active = () =>
        props.events.filter((event) => event.status === "scheduled" || event.status === "finished");
    return (
        <Statistics
            items={[
                {
                    label: "Events held",
                    value: active().filter((event) => event.startsAt < props.now).length,
                },
                {
                    label: "Upcoming",
                    value: active().filter((event) => event.startsAt >= props.now).length,
                },
            ]}
        />
    );
}
