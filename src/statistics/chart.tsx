import { createMemo, createSignal, For, Show } from "solid-js";

/** Explore dated totals with pointer, touch and keyboard controls. */
export function HistoryChart(props: { label: string; values: { date: string; value: number }[] }) {
    const [selected, setSelected] = createSignal<number>();
    const maximum = createMemo(() => {
        const highest = Math.max(1, ...props.values.map((point) => point.value));
        const magnitude = 10 ** Math.floor(Math.log10(highest));
        return Math.ceil(highest / magnitude) * magnitude;
    });
    const ticks = () => [maximum(), maximum() / 2, 0].filter(Number.isInteger);
    const years = createMemo(() => {
        const start = Date.parse(props.values[0]?.date ?? "");
        const end = Date.parse(props.values.at(-1)?.date ?? "");
        const result: { label: string; position: number }[] = [];
        for (
            let year = new Date(start).getUTCFullYear() + 1;
            year <= new Date(end).getUTCFullYear();
            year++
        ) {
            const position = (Date.UTC(year, 0, 1) - start) / (end - start);
            if (position > 0.1 && position < 0.9) result.push({ label: String(year), position });
        }
        return result;
    });
    const points = createMemo(() => {
        const start = Date.parse(props.values[0]?.date ?? "");
        const end = Date.parse(props.values.at(-1)?.date ?? "");

        return props.values.map((point) => ({
            ...point,
            x: start === end ? 500 : 12 + ((Date.parse(point.date) - start) / (end - start)) * 976,
            y: 276 - (point.value / maximum()) * 252,
        }));
    });
    const active = () => (selected() === undefined ? undefined : points()[selected()!]);
    const date = (value: string) =>
        new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
        }).format(new Date(value));

    // select the closest dated observation across the entire plotting area
    function inspect(event: PointerEvent & { currentTarget: SVGSVGElement }) {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * 1000;
        let nearest = 0;
        points().forEach((point, index) => {
            if (Math.abs(point.x - x) < Math.abs(points()[nearest].x - x)) nearest = index;
        });
        setSelected(nearest);
    }

    return (
        <Show when={points().length} fallback={<p class="stats-empty">No data</p>}>
            <Show
                when={points().length > 1}
                fallback={
                    <div class="stats-observation">
                        <strong>{props.values[0].value.toLocaleString()}</strong>
                        <span>{date(props.values[0].date)}</span>
                    </div>
                }
            >
                <div class="stats-chart">
                    <div class="stats-scale" aria-hidden="true">
                        <For each={ticks()}>
                            {(value) => (
                                <span style={{ top: `${92 - (value / maximum()) * 84}%` }}>
                                    {value.toLocaleString()}
                                </span>
                            )}
                        </For>
                    </div>
                    <div class="stats-plot">
                        <svg
                            viewBox="0 0 1000 300"
                            preserveAspectRatio="none"
                            tabindex="0"
                            role="img"
                            aria-label={`${props.label}. Use arrow keys to explore.`}
                            onPointerMove={inspect}
                            onPointerDown={inspect}
                            onPointerLeave={() => setSelected(undefined)}
                            onFocus={() => setSelected((index) => index ?? points().length - 1)}
                            onBlur={() => setSelected(undefined)}
                            onKeyDown={(event) => {
                                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                                event.preventDefault();
                                setSelected(
                                    Math.max(
                                        0,
                                        Math.min(
                                            points().length - 1,
                                            (selected() ?? points().length - 1) +
                                                (event.key === "ArrowLeft" ? -1 : 1),
                                        ),
                                    ),
                                );
                            }}
                        >
                            <For each={ticks()}>
                                {(value) => (
                                    <line
                                        x1="0"
                                        x2="1000"
                                        y1={276 - (value / maximum()) * 252}
                                        y2={276 - (value / maximum()) * 252}
                                        class="stats-gridline"
                                    />
                                )}
                            </For>
                            <polyline
                                points={points()
                                    .map((point) => `${point.x},${point.y}`)
                                    .join(" ")}
                                class="stats-line"
                            />
                            <For each={points()}>
                                {(point) => (
                                    <circle cx={point.x} cy={point.y} r="3" class="stats-point" />
                                )}
                            </For>
                            <Show when={active()}>
                                {(point) => (
                                    <>
                                        <line
                                            x1={point().x}
                                            x2={point().x}
                                            y1="12"
                                            y2="276"
                                            class="stats-crosshair"
                                        />
                                        <circle
                                            cx={point().x}
                                            cy={point().y}
                                            r="6"
                                            class="stats-point"
                                        />
                                    </>
                                )}
                            </Show>
                        </svg>
                        <Show when={active()}>
                            {(point) => (
                                <div
                                    class="stats-tooltip"
                                    role="status"
                                    style={{
                                        left: `clamp(90px, ${point().x / 10}%, calc(100% - 90px))`,
                                    }}
                                >
                                    <span>{date(point().date)}</span>
                                    <strong>
                                        {point().value.toLocaleString()} {props.label.toLowerCase()}
                                    </strong>
                                </div>
                            )}
                        </Show>
                        <div class="stats-dates">
                            <span>{date(props.values[0].date)}</span>
                            <For each={years()}>
                                {(year) => (
                                    <span
                                        class="stats-year"
                                        style={{ left: `${year.position * 100}%` }}
                                    >
                                        {year.label}
                                    </span>
                                )}
                            </For>
                            <Show when={props.values.length > 1}>
                                <span>{date(props.values.at(-1)!.date)}</span>
                            </Show>
                        </div>
                    </div>
                </div>
            </Show>
        </Show>
    );
}
