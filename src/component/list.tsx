import type { JSX } from "solid-js";
import { Show } from "solid-js";

/** Directory list. */
export function DirectoryList(props: { children: JSX.Element }) {
    return <section class="directory">{props.children}</section>;
}

/** Directory row. */
export function DirectoryRow(props: {
    eyebrow?: JSX.Element;
    href: string;
    meta?: JSX.Element;
    summary?: string;
    title: string;
}) {
    return (
        <a class="directory-row" href={props.href}>
            {/* heading */}
            <span class="directory-row__heading">
                <span class="directory-row__title">
                    <Show when={props.eyebrow}>
                        <span class="directory-row__eyebrow">{props.eyebrow}</span>
                    </Show>
                    <strong>{props.title}</strong>
                </span>
                <Show when={props.meta}>
                    <span class="directory-row__meta">{props.meta}</span>
                </Show>
            </span>

            {/* summary */}
            <Show when={props.summary}>
                <span class="directory-row__summary">{props.summary}</span>
            </Show>
        </a>
    );
}
