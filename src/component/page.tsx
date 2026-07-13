import type { JSX } from "solid-js";
import { Show, children } from "solid-js";

/** Page. */
export function Page(props: {
    children: JSX.Element;
    class?: string;
    width?: "normal" | "narrow";
}) {
    // width
    const width = props.width === "narrow" ? "page--narrow" : "";

    // classes
    const className = ["page", width, props.class].filter(Boolean).join(" ");

    return <section class={className}>{props.children}</section>;
}

/** Page header. */
export function PageHeader(props: { actions?: JSX.Element; summary?: string; title: string }) {
    return (
        <header class="page-header">
            {/* copy */}
            <div class="page-header__copy">
                <h1>{props.title}</h1>
                <Show when={props.summary}>
                    <p>{props.summary}</p>
                </Show>
            </div>

            {/* actions */}
            {props.actions}
        </header>
    );
}

/** Bordered section. */
export function Section(props: {
    children: JSX.Element;
    href?: string;
    meta?: string;
    title: string;
    toolbar?: JSX.Element;
}) {
    const toolbar = children(() => props.toolbar);

    return (
        <section class="section">
            {/* heading */}
            <header class="section__header">
                {/* title */}
                <h2>
                    <Show when={props.href} fallback={<>[{props.title}]</>}>
                        {(href) => <a href={href()}>[{props.title}]</a>}
                    </Show>
                </h2>

                {/* toolbar */}
                <Show when={toolbar()}>
                    <div class="section__toolbar">{toolbar()}</div>
                </Show>

                {/* count */}
                <Show when={props.meta}>
                    <span>{props.meta}</span>
                </Show>
            </header>

            {/* content */}
            <div class="section__body">{props.children}</div>
        </section>
    );
}

/** Detail list. */
export function DetailList(props: { children: JSX.Element }) {
    return <dl class="detail-list">{props.children}</dl>;
}

/** Detail row. */
export function DetailRow(props: { label: string; value: JSX.Element }) {
    return (
        <div class="detail-row">
            <dt>{props.label}</dt>
            <dd>{props.value}</dd>
        </div>
    );
}
