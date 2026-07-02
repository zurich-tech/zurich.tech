import type { JSX } from "solid-js";
import { Show } from "solid-js";

/** Page. */
export function Page(props: { children: JSX.Element; width?: "normal" | "narrow" }) {
    // width
    const width = props.width === "narrow" ? "max-w-3xl" : "max-w-5xl";

    return (
        <section class={`mx-auto grid ${width} gap-10 px-4 py-10 md:px-6 md:py-14`}>
            {props.children}
        </section>
    );
}

/** Page header. */
export function PageHeader(props: { actions?: JSX.Element; summary?: string; title: string }) {
    return (
        <header class="flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
            {/* copy */}
            <div class="grid gap-1">
                <h1 class="text-xl font-medium lowercase">{props.title}</h1>
                <Show when={props.summary}>
                    <p class="max-w-2xl text-soft">{props.summary}</p>
                </Show>
            </div>

            {/* actions */}
            {props.actions}
        </header>
    );
}

/** Section, a legend-labelled pixel box. */
export function Section(props: { children: JSX.Element; meta?: string; title: string }) {
    return (
        <section class="pixel-box p-4">
            {/* legend */}
            <h2 class="pixel-label lowercase">
                <span class="font-medium text-ink">{props.title}</span>
                <Show when={props.meta}>
                    {" · "}
                    {props.meta}
                </Show>
            </h2>

            {props.children}
        </section>
    );
}

/** Detail list. */
export function DetailList(props: { children: JSX.Element }) {
    return <dl class="grid divide-y divide-line text-sm">{props.children}</dl>;
}

/** Detail row. */
export function DetailRow(props: { label: string; value: JSX.Element }) {
    return (
        <div class="grid gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0 md:grid-cols-[8rem_1fr]">
            <dt class="text-xs leading-6 lowercase text-soft">{props.label}</dt>
            <dd>{props.value}</dd>
        </div>
    );
}
