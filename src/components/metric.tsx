import { createMemo, Show, type JSX } from "solid-js";
import "./metric.css";

/** Present a headline number with an optional trend and supporting figures. */
export function Metric(props: {
    /** Metric label. */
    label: string;
    /** Formatted headline value. */
    value: string;
    /** Optional detail destination. */
    href?: string;
    /** Optional fragment target. */
    id?: string;
    /** Whether this metric selects the current detail view. */
    isSelected?: boolean;
    /** Dated observations for the decorative trend. */
    trend?: { date: string; value: number }[];
    /** Supporting rows or a short caption. */
    children?: JSX.Element;
}) {
    // scale observations by elapsed time and retain a zero baseline
    const points = createMemo(() => {
        const values = props.trend ?? [];
        if (values.length < 2) return "";
        const start = Date.parse(values[0].date);
        const duration = Date.parse(values.at(-1)!.date) - start;
        const maximum = Math.max(1, ...values.map((point) => point.value));

        return values
            .map((point) => {
                const x = duration ? 2 + (116 * (Date.parse(point.date) - start)) / duration : 118;
                const y = 46 - (42 * point.value) / maximum;

                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
    });

    return (
        <a
            href={props.href}
            id={props.id}
            class="metric"
            aria-current={props.isSelected ? "true" : undefined}
        >
            <span class="metric-label">{props.label}</span>
            <div class="metric-headline">
                <strong class="metric-value">{props.value}</strong>
                <Show when={points()}>
                    <svg class="metric-trend" viewBox="0 0 120 50" aria-hidden="true">
                        <polygon points={`2,48 ${points()} 118,48`} />
                        <polyline points={points()} />
                    </svg>
                </Show>
            </div>
            <div class="metric-details">{props.children}</div>
        </a>
    );
}
