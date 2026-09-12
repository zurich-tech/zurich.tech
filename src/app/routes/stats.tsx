import { createAsync } from "@solidjs/router";
import { createSignal, For, Show } from "solid-js";
import { getStatistics } from "../../statistics/queries";
import { HistoryChart } from "../../statistics/chart";
import { Card } from "../../components/card";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";
import "../../statistics/style.css";

const metrics = [
    { field: "events", label: "Events" },
    { field: "subscribers", label: "Subscribers" },
    { field: "registrations", label: "Registrations" },
] as const;

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getStatistics(),
};

/** Explore community totals and growth. */
export default function Route() {
    const statistics = createAsync(() => getStatistics());
    const [selected, setSelected] = createSignal<(typeof metrics)[number]>(metrics[0]);

    return (
        <>
            <Seo title="Stats" description="Community growth at zurich.tech." />
            <Page class="stats-page">
                <PageHeader title="Stats" />
                <Show when={statistics()}>
                    {(current) => (
                        <>
                            <div class="stats-metrics">
                                <For each={metrics}>
                                    {(metric) => (
                                        <button
                                            class="stats-metric"
                                            aria-pressed={selected().field === metric.field}
                                            onClick={() => setSelected(metric)}
                                        >
                                            <span class="stats-label">{metric.label}</span>
                                            <div class="stats-value">
                                                <strong>
                                                    {current().totals[
                                                        metric.field
                                                    ].toLocaleString()}
                                                </strong>
                                                <Show when={current().growth[metric.field]}>
                                                    {(growth) => (
                                                        <span
                                                            class="stats-growth"
                                                            classList={{
                                                                "is-positive": growth().value > 0,
                                                                "is-negative": growth().value < 0,
                                                            }}
                                                            title={`${growth().isEstimated ? "Estimated change" : "Change"} since ${growth().since}`}
                                                        >
                                                            {growth().value > 0 ? "+" : ""}
                                                            {growth().value.toLocaleString()}
                                                            <span class="stats-period">
                                                                Last 30 days
                                                            </span>
                                                        </span>
                                                    )}
                                                </Show>
                                            </div>
                                        </button>
                                    )}
                                </For>
                            </div>
                            <Card title={selected().label} class="stats-chart-card">
                                <Show when={selected()} keyed>
                                    {(metric) => (
                                        <HistoryChart
                                            label={metric.label}
                                            values={current().history[metric.field]}
                                        />
                                    )}
                                </Show>
                            </Card>
                        </>
                    )}
                </Show>
            </Page>
        </>
    );
}
