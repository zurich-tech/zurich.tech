import { For } from "solid-js";

/** Show known capacity and live native availability using labelled icons. */
export function Capacity(props: {
    /** Configured limit; null means unlimited, undefined means unknown. */
    total?: number | null;
    /** Confirmed attendees, omitted when live counts are unavailable. */
    confirmed?: number;
    /** Waiting attendees, omitted when live counts are unavailable. */
    waitlisted?: number;
}) {
    // omit unknown values rather than presenting an external event as empty
    const counts = () =>
        [
            {
                label: "Total capacity",
                value: props.total,
                path: "M2 13V8h12v5M4 8V3h8v5M5 13v-3h6v3",
            },
            {
                label: "Available places",
                value:
                    props.confirmed === undefined ||
                    props.total === undefined ||
                    props.total === null
                        ? undefined
                        : Math.max(0, props.total - props.confirmed),
                path: "M3 8l3 3 7-7",
            },
            {
                label: "Waitlisted",
                value: props.total === null ? undefined : props.waitlisted,
                path: "M8 4v4l3 2M14 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0",
            },
        ].filter((count) => count.value !== undefined);

    return (
        <span class="capacity">
            <For each={counts()}>
                {(count) => (
                    <span
                        class="capacity-count"
                        title={`${count.label}: ${count.value === null ? "unlimited" : count.value}`}
                        aria-label={`${count.label}: ${count.value === null ? "unlimited" : count.value}`}
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path
                                d={count.path}
                                stroke="currentColor"
                                stroke-width="1.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <span aria-hidden="true">{count.value === null ? "∞" : count.value}</span>
                    </span>
                )}
            </For>
        </span>
    );
}
