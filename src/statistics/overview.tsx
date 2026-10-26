import { For } from "solid-js";
import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { Metric } from "../components/metric";
import "./style.css";

/** Public metrics in their shared display order. */
export const metrics = [
    { field: "subscribers", label: "Members", id: "members" },
    { field: "events", label: "Events", id: "events" },
    { field: "registrations", label: "Registrations", id: "registrations" },
] as const;

/** Show community totals, historical trends and rolling growth on public pages. */
export function StatisticsOverview(props: {
    /** Public aggregate statistics. */
    statistics: FunctionReturnType<typeof api.statistics.queries.community>;
    /** Metric currently displayed on the statistics page. */
    selected?: string;
}) {
    return (
        <div class="metric-row" aria-label="Community statistics">
            <For each={metrics}>
                {(metric) => (
                    <Metric
                        id={metric.id}
                        href={`/stats#${metric.id}`}
                        isSelected={props.selected === metric.field}
                        label={metric.label}
                        value={props.statistics.totals[metric.field].toLocaleString("en-CH")}
                        trend={
                            metric.field === "events"
                                ? props.statistics.history.events.map((point) => ({
                                      date: point.date,
                                      value: point.ours,
                                  }))
                                : props.statistics.history[metric.field]
                        }
                    >
                        <div class="stats-changes">
                            <For each={props.statistics.growth}>
                                {(period) => {
                                    const growth = period[metric.field];

                                    return (
                                        <div
                                            class="stats-change"
                                            title={
                                                growth
                                                    ? `Change since ${growth.since}`
                                                    : "Historical baseline unavailable"
                                            }
                                        >
                                            <span class="stats-period">
                                                {period.days === 365 ? "1y" : `${period.days}d`}
                                            </span>
                                            <span
                                                class="stats-growth"
                                                data-positive={growth && growth.value > 0}
                                            >
                                                {growth
                                                    ? `${growth.value > 0 ? "+" : ""}${growth.value.toLocaleString("en-CH")}`
                                                    : "–"}
                                            </span>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </Metric>
                )}
            </For>
        </div>
    );
}
