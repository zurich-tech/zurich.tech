import {
    For,
    Show,
    children,
    createEffect,
    createSignal,
    onCleanup,
    onMount,
    type JSX,
} from "solid-js";

/** Choose a filter using buttons or links with the same scrolling behaviour. */
export function FilterPills(props: {
    label: string;
    options: { value: string; label: string; href?: string }[];
    value: string;
    onChange?: (value: string) => void;
    class?: string;
}) {
    return (
        <PillRow label={props.label} value={props.value} class={props.class}>
            <For each={props.options}>
                {(option) => (
                    <Show
                        when={option.href}
                        fallback={
                            <button
                                type="button"
                                aria-pressed={props.value === option.value}
                                classList={{ selected: props.value === option.value }}
                                onClick={() => props.onChange?.(option.value)}
                            >
                                {option.label}
                            </button>
                        }
                    >
                        <a
                            href={option.href}
                            classList={{ selected: props.value === option.value }}
                            aria-current={props.value === option.value ? "page" : undefined}
                        >
                            {option.label}
                        </a>
                    </Show>
                )}
            </For>
        </PillRow>
    );
}

/** Scroll pill choices without wrapping, with edge controls for mouse users. */
export function PillRow(props: {
    label: string;
    value?: string;
    class?: string;
    children: JSX.Element;
}) {
    let row!: HTMLDivElement;
    const content = children(() => props.children);
    const [before, setBefore] = createSignal(false);
    const [after, setAfter] = createSignal(false);
    let mounted = false;

    /** Show edge controls only while more choices remain in that direction. */
    function update() {
        setBefore(row.scrollLeft > 1);
        setAfter(row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
    }

    /** Move only this row, never the surrounding page, to expose a choice. */
    function reveal(item: HTMLElement | null) {
        if (!mounted || !item) return;
        const bounds = row.getBoundingClientRect();
        const target = item.getBoundingClientRect();
        const inset = parseFloat(getComputedStyle(row).getPropertyValue("--pill-edge"));
        const left = bounds.left + (before() ? inset : 0);
        const right = bounds.right - (after() ? inset : 0);
        if (target.left < left) row.scrollLeft += target.left - left;
        else if (target.right > right) row.scrollLeft += target.right - right;
        update();
    }

    /** Update dimensions and keep the selected filter visible after layout changes. */
    function refresh() {
        if (!mounted) return;
        update();
        const focused = document.activeElement as HTMLElement | null;
        reveal(
            focused && row.contains(focused)
                ? focused
                : row.querySelector<HTMLElement>(".selected, [aria-pressed='true']"),
        );
    }

    // follow selection and option changes without intercepting wheel or touch gestures
    createEffect(() => {
        props.value;
        content();
        queueMicrotask(refresh);
    });
    onMount(() => {
        mounted = true;
        const observer = new ResizeObserver(refresh);
        observer.observe(row);
        const changes = new MutationObserver(refresh);
        changes.observe(row, { childList: true, subtree: true, characterData: true });
        void document.fonts.ready.then(refresh);
        refresh();
        onCleanup(() => {
            mounted = false;
            observer.disconnect();
            changes.disconnect();
        });
    });

    /** Page horizontally while respecting reduced motion. */
    function scroll(direction: number) {
        row.scrollBy({
            left: direction * row.clientWidth * 0.75,
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        });
    }

    return (
        <div class={`pill-strip ${props.class ?? ""}`}>
            <div
                ref={row}
                class="filter-pills"
                role="group"
                aria-label={props.label}
                onScroll={update}
                onFocusIn={(event) => reveal(event.target as HTMLElement)}
            >
                {content()}
            </div>
            <button
                class="pill-scroll pill-scroll--back"
                type="button"
                hidden={!before()}
                tabIndex={-1}
                aria-label={`Scroll ${props.label.toLowerCase()} left`}
                onClick={() => scroll(-1)}
            >
                ‹
            </button>
            <button
                class="pill-scroll pill-scroll--forward"
                type="button"
                hidden={!after()}
                tabIndex={-1}
                aria-label={`Scroll ${props.label.toLowerCase()} right`}
                onClick={() => scroll(1)}
            >
                ›
            </button>
        </div>
    );
}
