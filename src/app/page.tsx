import type { JSX } from "solid-js";
import { Show } from "solid-js";

/** Place page content within the shared site grid. */
export function Page(props: {
    /** Page contents. */
    children: JSX.Element;
    /** Additional page layout classes. */
    class?: string;
    /** Content width within the shared site grid. */
    width?: "normal" | "narrow";
}) {
    // width
    const width = props.width === "narrow" ? "page--narrow" : "";

    // classes
    const className = ["page", width, props.class].filter(Boolean).join(" ");

    return <section class={className}>{props.children}</section>;
}

/** Render the page title and optional description. */
export function PageHeader(props: { summary?: string; title: string; actions?: JSX.Element }) {
    return (
        <header class="page-header">
            {/* copy */}
            <div class="page-header__copy">
                <h1>{props.title}</h1>
                <Show when={props.summary}>
                    <p>{props.summary}</p>
                </Show>
            </div>
            <div class="page-header__actions">{props.actions}</div>
        </header>
    );
}

/** Group labeled event or account details. */
export function DetailList(props: { children: JSX.Element }) {
    return <dl class="detail-list">{props.children}</dl>;
}

/** Pair one detail label with its value. */
export function DetailRow(props: { label: string; value: JSX.Element }) {
    return (
        <div class="detail-row">
            <dt>{props.label}</dt>
            <dd>{props.value}</dd>
        </div>
    );
}
