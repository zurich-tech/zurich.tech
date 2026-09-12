import { Show } from "solid-js";
import "./counts.css";

/** Show confirmed places and queues with the same notation on every event surface. */
export function EventCounts(props: {
    compact?: boolean;
    confirmed?: number;
    limit?: number | null;
    waitlist?: number;
    pending?: number;
}) {
    const label = () =>
        [
            props.confirmed === undefined ? undefined : `${props.confirmed} confirmed`,
            props.limit == null ? undefined : `${props.limit} registration limit`,
            props.waitlist ? `${props.waitlist} waitlisted` : undefined,
            props.pending ? `${props.pending} pending approval` : undefined,
        ]
            .filter(Boolean)
            .join(", ");

    return (
        <Show when={props.confirmed !== undefined || props.limit != null}>
            <span
                class="event-counts"
                classList={{ "event-counts--compact": props.compact }}
                aria-label={label()}
                title={label()}
            >
                <Show when={props.confirmed !== undefined} fallback={<>{props.limit} places</>}>
                    <strong>{props.confirmed}</strong>
                    <Show when={props.limit != null}>
                        <span> / {props.limit}</span>
                    </Show>
                    <Show when={props.limit == null && !props.compact}>
                        <span> registered</span>
                    </Show>
                </Show>
                <Show when={props.waitlist}>
                    <span>
                        {props.compact ? `(+${props.waitlist})` : ` · +${props.waitlist} waitlist`}
                    </span>
                </Show>
                <Show when={props.pending}>
                    <span> · {props.pending} pending</span>
                </Show>
                <Show when={props.compact}>
                    <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="9" cy="7" r="3" />
                        <path d="M3 21v-2a6 6 0 0 1 12 0v2M17 4a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-3-5.2" />
                    </svg>
                </Show>
            </span>
        </Show>
    );
}
