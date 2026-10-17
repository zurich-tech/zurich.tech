import { type JSX, For, Show } from "solid-js";

import { Highlight } from "./highlight";
import "./list.css";

/** Directory list. */
export function DirectoryList(props: { children: JSX.Element }) {
    return <section class="directory">{props.children}</section>;
}

/** Directory row. */
export function DirectoryRow(props: {
    eyebrow?: JSX.Element;
    href: string;
    meta?: JSX.Element;
    summary?: JSX.Element;
    tags?: string[];
    terms?: readonly string[];
    title: JSX.Element;
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

            {/* tags */}
            <Show when={props.tags !== undefined && props.tags.length > 0}>
                <span class="directory-row__tags">
                    <For each={props.tags}>
                        {(tag) => (
                            <span>
                                #<Highlight text={tag} terms={props.terms ?? []} />
                            </span>
                        )}
                    </For>
                </span>
            </Show>
        </a>
    );
}
