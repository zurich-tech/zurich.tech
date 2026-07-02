import type { JSX } from "solid-js";
import { Show } from "solid-js";

/** Directory list. */
export function DirectoryList(props: { children: JSX.Element }) {
    return <section class="grid">{props.children}</section>;
}

/** Directory row. */
export function DirectoryRow(props: {
    eyebrow?: string;
    href: string;
    meta?: string;
    summary?: string;
    title: string;
}) {
    return (
        <a class="group grid gap-1 border-b border-line py-4 last:border-b-0" href={props.href}>
            {/* heading */}
            <span class="flex flex-wrap items-baseline justify-between gap-3">
                <span class="flex items-baseline gap-3">
                    <Show when={props.eyebrow}>
                        <span class="text-xs lowercase text-soft">{props.eyebrow}</span>
                    </Show>
                    <span class="font-medium group-hover:underline group-hover:underline-offset-4">
                        {props.title}
                    </span>
                </span>
                <Show when={props.meta}>
                    <span class="text-xs lowercase text-soft">{props.meta}</span>
                </Show>
            </span>

            {/* summary */}
            <Show when={props.summary}>
                <span class="max-w-3xl text-soft">{props.summary}</span>
            </Show>
        </a>
    );
}
