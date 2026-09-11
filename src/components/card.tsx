import type { JSX } from "solid-js";
import { Show, children } from "solid-js";
import { Dynamic } from "solid-js/web";

/** Group content under a consistent bordered heading. */
export function Card(props: {
    /** Card heading. */
    title: JSX.Element;
    /** Optional destination for the heading. */
    titleHref?: string;
    /** Contents below the heading. */
    children?: JSX.Element;
    /** Additional layout classes. */
    class?: string;
    /** Heading level within the page. */
    heading?: "h1" | "h2";
    /** Optional heading controls. */
    toolbar?: JSX.Element;
    /** Optional count beside the heading. */
    meta?: JSX.Element;
    /** Optional anchor for this card. */
    id?: string;
}) {
    // resolve optional controls once before placing them in the heading
    const toolbar = children(() => props.toolbar);

    return (
        <section class={`card ${props.class ?? ""}`} id={props.id}>
            {/* align the title, controls and count within one shared heading */}
            <header class="card-heading">
                <Dynamic component={props.heading ?? "h2"} class="card-title">
                    <Show when={props.titleHref} fallback={props.title}>
                        {(href) => <a href={href()}>{props.title}</a>}
                    </Show>
                </Dynamic>
                <Show when={toolbar()}>
                    <div class="card-toolbar">{toolbar()}</div>
                </Show>
                <Show when={props.meta !== undefined && props.meta !== null}>
                    <span>{props.meta}</span>
                </Show>
            </header>
            {/* place content below the shared divider */}
            <div class="card-body">{props.children}</div>
        </section>
    );
}
