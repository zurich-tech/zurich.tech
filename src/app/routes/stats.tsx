import { createSignal, onMount, Show } from "solid-js";
import { useLocation } from "@solidjs/router";
import { getStatistics } from "../../statistics/queries";
import { HistoryChart } from "../../statistics/chart";
import { StatisticsOverview, metrics } from "../../statistics/overview";
import { Card } from "../../components/card";
import { Page, PageHeader } from "../page";
import { Seo } from "../seo";

/** Begin public data requests before rendering the route. */
export const route = {
    preload: () => getStatistics(),
};

/** Explore community totals and growth. */
export default function Route() {
    const statistics = getStatistics.use(() => []);
    const location = useLocation();
    const [isMounted, setMounted] = createSignal(false);
    onMount(() => setMounted(true));

    // resolve the fragment after hydration because the server never receives it
    const selected = () =>
        metrics.find((metric) => isMounted() && `#${metric.id}` === location.hash) ?? metrics[0];

    return (
        <>
            <Seo
                title="Stats"
                description="zurich.tech events, members and registrations over time."
            />
            <Page class="stats-page publication">
                <PageHeader title="Stats" />
                <Show when={statistics()}>
                    {(current) => (
                        <>
                            <StatisticsOverview
                                statistics={current()}
                                selected={selected().field}
                            />
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
