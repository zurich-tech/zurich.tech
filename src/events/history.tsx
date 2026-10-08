import { createMemo, createResource, createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { SignupDay } from "../../convex/events/history";
import { useAccess } from "../auth/edit";
import { memberClient } from "../auth/convex";
import "./history.css";

/** Fetch private signup aggregates only for this event's organisers. */
export function RegistrationHistory(props: { eventId: Id<"events"> }) {
    const access = useAccess();
    const key = () =>
        access.canEvent(props.eventId, "organiser")
            ? `${access.account.user()?.id}:${props.eventId}`
            : undefined;
    const [history, { refetch }] = createResource(key, async (key) => ({
        key,
        days: await (
            await memberClient()
        ).query(api.events.registrations.history, {
            eventId: props.eventId,
        }),
    }));

    // never read a failed resource or display another account's result
    const days = () => {
        if (history.error || history.loading || !key()) return [];
        const result = history.latest;

        return result && result.key === key() ? result.days : [];
    };

    // refresh after managing registrations or returning from another tab
    onMount(() => {
        const refresh = () => {
            if (key()) void refetch();
        };
        window.addEventListener("focus", refresh);
        onCleanup(() => window.removeEventListener("focus", refresh));
    });

    return (
        <Show when={key()}>
            <Show when={history.error}>
                <p class="form-error" role="alert">
                    Could not load signup history.{" "}
                    <button onClick={() => void refetch()}>Retry</button>
                </p>
            </Show>
            <Show when={days().length > 1 && days().at(-1)!.total >= 2}>
                <SignupChart days={days()} />
            </Show>
        </Show>
    );
}

/** Render a compact daily chart with pointer and keyboard inspection. */
function SignupChart(props: { days: SignupDay[] }) {
    const format = new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    });
    const [selected, setSelected] = createSignal<number>();
    const index = () => Math.min(selected() ?? props.days.length - 1, props.days.length - 1);
    const day = () => props.days[index()];
    const x = (index: number) => 4 + (index / (props.days.length - 1)) * 292;
    const y = (total: number) => 96 - (total / props.days.at(-1)!.total) * 88;
    const points = createMemo(() =>
        props.days.map((day, index) => `${x(index)},${y(day.total)}`).join(" "),
    );
    const date = (value: string) => format.format(new Date(value));

    return (
        <figure class="signup-history">
            <figcaption>
                Signups over time <span>Organisers only</span>
            </figcaption>
            <svg
                viewBox="0 0 300 100"
                role="img"
                aria-label={`Cumulative first signups: ${props.days.at(-1)!.total}`}
            >
                <path class="signup-history__baseline" d="M4 96H296" />
                <polyline points={points()} />
                <circle cx={x(index())} cy={y(day().total)} r="3" />
                <For each={props.days}>
                    {(value, index) => (
                        <rect
                            x={x(index()) - 146 / (props.days.length - 1)}
                            y="0"
                            width={292 / (props.days.length - 1)}
                            height="100"
                            fill="transparent"
                            onPointerEnter={() => setSelected(index())}
                        >
                            <title>
                                {date(value.date)}: {value.total} total, {value.added} new
                            </title>
                        </rect>
                    )}
                </For>
            </svg>
            <div class="signup-history__dates">
                <time dateTime={props.days[0].date}>{date(props.days[0].date)}</time>
                <time dateTime={props.days.at(-1)!.date}>{date(props.days.at(-1)!.date)}</time>
            </div>
            <input
                type="range"
                min="0"
                max={props.days.length - 1}
                step="1"
                value={index()}
                aria-label="Signup date"
                aria-valuetext={`${date(day().date)}: ${day().total} total, ${day().added} new`}
                onInput={(event) => setSelected(Number(event.currentTarget.value))}
            />
            <p class="signup-history__value">
                {date(day().date)} · <strong>{day().total} total</strong> · +{day().added} new
            </p>
            <p class="signup-history__note">
                First signups, including cancelled, declined and waitlisted registrations. Imports
                excluded. Zurich time.
            </p>
        </figure>
    );
}
