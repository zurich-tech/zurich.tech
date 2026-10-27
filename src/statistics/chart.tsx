import { createMemo, createSignal, For, Show, onMount, onCleanup } from "solid-js";

/** Explore dated totals with pointer, touch and keyboard controls. */
export function HistoryChart(props: {
    label: string;
    /** Dated community milestones linking to events and announcements. */
    milestones?: { date: string; label: string; description: string; href: string }[];
    values: {
        date: string;
        value: number;
        isEstimated?: boolean;
        ours?: number;
        external?: number;
    }[];
}) {
    const [selected, setSelected] = createSignal<number>();
    const [highlighted, setHighlighted] = createSignal<string>();
    const [plotWidth, setPlotWidth] = createSignal(560);
    let plot: HTMLDivElement | undefined;

    // measure the plot so label spacing stays compact at every viewport width
    onMount(() => {
        let frame: number | undefined;
        const observer = new ResizeObserver(([entry]) => {
            if (frame !== undefined) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => setPlotWidth(entry.contentRect.width));
        });
        if (plot) observer.observe(plot);
        onCleanup(() => {
            observer.disconnect();
            if (frame !== undefined) cancelAnimationFrame(frame);
        });
    });
    const maximum = createMemo(() => {
        const highest = Math.max(1, ...props.values.map((point) => point.value));
        const magnitude = 10 ** Math.floor(Math.log10(highest));
        return Math.ceil(highest / magnitude) * magnitude;
    });
    const ticks = () => [maximum(), maximum() / 2, 0].filter(Number.isInteger);
    const years = createMemo(() => {
        const start = Date.parse(props.values[0]?.date ?? "");
        const end = Date.parse(props.values.at(-1)?.date ?? "");
        if (start === end)
            return [{ label: String(new Date(start).getUTCFullYear()), position: 0.5 }];
        const result: { label: string; position: number }[] = [];
        for (
            let year = new Date(start).getUTCFullYear() + 1;
            year <= new Date(end).getUTCFullYear();
            year++
        ) {
            const position = (Date.UTC(year, 0, 1) - start) / (end - start);
            if (position >= 0 && position <= 1)
                result.push({ label: String(year), position: 0.012 + position * 0.976 });
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
            oursY: point.ours === undefined ? undefined : 276 - (point.ours / maximum()) * 252,
        }));
    });
    const active = () => (selected() === undefined ? undefined : points()[selected()!]);
    const isStacked = () => points()[0]?.ours !== undefined;
    const milestones = createMemo(() => {
        const start = Date.parse(props.values[0]?.date ?? "");
        const end = Date.parse(props.values.at(-1)?.date ?? "");
        const rows: number[] = [];

        return (props.milestones ?? [])
            .toSorted((left, right) => left.date.localeCompare(right.date))
            .flatMap((milestone) => {
                const at = Date.parse(milestone.date);
                if (at < start || at > end || start === end) return [];

                // keep labels over their dates, using another row only for nearby labels
                const x = 12 + ((at - start) / (end - start)) * 976;
                const halfLabel = (60 / plotWidth()) * 1000;
                const labelX = Math.max(halfLabel, Math.min(1000 - halfLabel, x));
                const spacing = (132 / plotWidth()) * 1000;
                const available = rows.findIndex((previous) => labelX - previous >= spacing);
                const row = available === -1 ? rows.length : available;
                rows[row] = labelX;

                return [{ ...milestone, x, labelX, row }];
            });
    });
    const milestoneHeight = () =>
        milestones().length
            ? (Math.max(...milestones().map((milestone) => milestone.row)) + 1) * 48 + 20
            : 0;
    const date = (value: string) =>
        new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
        }).format(new Date(value));

    // select the closest dated observation across the entire plotting area
    /** Select the plotted date nearest the pointer. */
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
            <div
                class="stats-chart"
                classList={{ "stats-chart--milestones": milestones().length > 0 }}
                style={{ "--milestone-height": `${milestoneHeight()}px` }}
            >
                <div class="stats-scale" aria-hidden="true">
                    <For each={ticks()}>
                        {(value) => (
                            <span style={{ top: `${92 - (value / maximum()) * 84}%` }}>
                                {value.toLocaleString()}
                            </span>
                        )}
                    </For>
                </div>
                <div class="stats-plot" ref={plot}>
                    <Show when={milestones().length > 0}>
                        <div class="stats-milestones">
                            <For each={milestones()}>
                                {(milestone) => (
                                    <span
                                        class="stats-milestone"
                                        style={{
                                            left: `${milestone.labelX / 10}%`,
                                            top: `${milestone.row * 48}px`,
                                        }}
                                        classList={{
                                            "is-highlighted": highlighted() === milestone.date,
                                        }}
                                        onPointerEnter={() => setHighlighted(milestone.date)}
                                        onPointerLeave={() => setHighlighted(undefined)}
                                        onFocusIn={() => setHighlighted(milestone.date)}
                                        onFocusOut={() => setHighlighted(undefined)}
                                    >
                                        <a href={milestone.href} aria-label={milestone.description}>
                                            {milestone.label}
                                            <small>{date(milestone.date)}</small>
                                        </a>
                                    </span>
                                )}
                            </For>
                            <svg
                                class="stats-milestone-connectors"
                                viewBox={`0 0 1000 ${milestoneHeight()}`}
                                preserveAspectRatio="none"
                                aria-hidden="true"
                            >
                                <For each={milestones()}>
                                    {(milestone) => (
                                        <path
                                            d={`M ${milestone.labelX} ${milestone.row * 48 + 40} L ${milestone.x} ${milestone.row * 48 + 56} V ${milestoneHeight()}`}
                                            class="stats-milestone-line"
                                            classList={{
                                                "is-highlighted": highlighted() === milestone.date,
                                            }}
                                        />
                                    )}
                                </For>
                            </svg>
                        </div>
                    </Show>
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
                        <Show
                            when={isStacked()}
                            fallback={
                                <polygon
                                    points={[
                                        `${points()[0].x},276`,
                                        ...points().map((point) => `${point.x},${point.y}`),
                                        `${points().at(-1)!.x},276`,
                                    ].join(" ")}
                                    class="stats-area stats-area--ours"
                                />
                            }
                        >
                            <polygon
                                points={[
                                    ...points().map((point) => `${point.x},${point.y}`),
                                    ...points()
                                        .toReversed()
                                        .map((point) => `${point.x},${point.oursY}`),
                                ].join(" ")}
                                class="stats-area stats-area--external"
                            />
                            <polygon
                                points={[
                                    `${points()[0].x},276`,
                                    ...points().map((point) => `${point.x},${point.oursY}`),
                                    `${points().at(-1)!.x},276`,
                                ].join(" ")}
                                class="stats-area stats-area--ours"
                            />
                            <polyline
                                points={points()
                                    .map((point) => `${point.x},${point.oursY}`)
                                    .join(" ")}
                                class="stats-line"
                            />
                        </Show>
                        <polyline
                            points={points()
                                .map((point) => `${point.x},${point.y}`)
                                .join(" ")}
                            class="stats-line"
                            classList={{ "stats-line--total": isStacked() }}
                        />
                        <Show when={points().length === 1}>
                            <circle
                                cx={points()[0].x}
                                cy={points()[0].y}
                                r="5"
                                class="stats-point"
                            />
                        </Show>
                        <For each={milestones()}>
                            {(milestone) => (
                                <line
                                    x1={milestone.x}
                                    x2={milestone.x}
                                    y1="0"
                                    y2="276"
                                    class="stats-milestone-line"
                                    classList={{
                                        "is-highlighted": highlighted() === milestone.date,
                                    }}
                                />
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
                                <Show when={isStacked()}>
                                    <span>
                                        Ours {point().ours?.toLocaleString()} · Partner{" "}
                                        {point().external?.toLocaleString()}
                                    </span>
                                </Show>
                            </div>
                        )}
                    </Show>
                    <div class="stats-dates">
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
                    </div>
                </div>
            </div>
        </Show>
    );
}
