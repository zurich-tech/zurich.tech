import { Loading } from "./loading";
import type { JSX } from "solid-js";
import { Show, children, Suspense, onMount, onCleanup } from "solid-js";

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
    let section!: HTMLElement;

    // resolve deep links after the asynchronous card has entered the document
    onMount(() => {
        if (!props.id || window.location.hash !== `#${props.id}`) return;
        const frame = requestAnimationFrame(() => section.scrollIntoView({ block: "start" }));
        onCleanup(() => cancelAnimationFrame(frame));
    });

    return (
        <section ref={section} class={`card ${props.class ?? ""}`} id={props.id}>
            {/* align the title, controls and count within one shared heading */}
            <header class="card-heading">
                <Show
                    when={props.heading === "h1"}
                    fallback={
                        <h2 class="card-title">
                            <Show when={props.titleHref} fallback={props.title}>
                                {(href) => <a href={href()}>{props.title}</a>}
                            </Show>
                        </h2>
                    }
                >
                    <h1 class="card-title">
                        <Show when={props.titleHref} fallback={props.title}>
                            {(href) => <a href={href()}>{props.title}</a>}
                        </Show>
                    </h1>
                </Show>
                <Show when={toolbar()}>
                    <div class="card-toolbar">{toolbar()}</div>
                </Show>
                <Show when={props.meta !== undefined && props.meta !== null}>
                    <span>{props.meta}</span>
                </Show>
            </header>
            {/* place content below the shared divider */}
            <div class="card-body">
                <Suspense fallback={<Loading />}>{props.children}</Suspense>
            </div>
        </section>
    );
}

/** Introduce a card with the same typography and section spacing. */
export function CardIntro(props: { children: JSX.Element }) {
    return (
        <div class="card-section card-intro">
            <p>{props.children}</p>
        </div>
    );
}
