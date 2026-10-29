import { Check, ChevronDown, Search, X } from "lucide-solid";
import { createMemo, createSignal, createUniqueId, For, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { SelectionOption } from "./selection";
import "./filters.css";

/** Choose one catalogue filter using the shared searchable filter panel. */
export function FilterSelect(props: {
    label: string;
    value: string;
    options: readonly SelectionOption[];
    onChange: (value: string) => void;
}) {
    const id = createUniqueId();
    const [isOpen, setOpen] = createSignal(false);
    const [search, setSearch] = createSignal("");
    const [active, setActive] = createSignal(0);
    const [position, setPosition] = createSignal({
        left: "0px",
        top: "0px",
        width: "280px",
        "max-height": "400px",
        transform: "none",
    });
    let trigger!: HTMLButtonElement;
    let panel: HTMLDivElement | undefined;
    let input: HTMLInputElement | undefined;
    const matches = createMemo(() =>
        props.options.filter((option) =>
            `${option.label} ${option.aliases ?? ""}`
                .toLocaleLowerCase()
                .includes(search().trim().toLocaleLowerCase()),
        ),
    );

    /** Fit the panel around its trigger, including the mobile keyboard viewport. */
    function place() {
        if (!isOpen()) return;
        const bounds = trigger.getBoundingClientRect();
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft ?? 0;
        const top = viewport?.offsetTop ?? 0;
        const width = viewport?.width ?? window.innerWidth;
        const height = viewport?.height ?? window.innerHeight;
        const panelWidth = Math.min(320, width - 16);
        const below = Math.max(0, top + height - bounds.bottom - 12);
        const above = Math.max(0, bounds.top - top - 12);
        const isBelow = below >= Math.min(320, above);
        setPosition({
            left: `${Math.max(left + 8, Math.min(bounds.left, left + width - panelWidth - 8))}px`,
            top: `${isBelow ? bounds.bottom + 4 : bounds.top - 4}px`,
            width: `${panelWidth}px`,
            "max-height": `${Math.min(400, isBelow ? below : above)}px`,
            transform: isBelow ? "none" : "translateY(-100%)",
        });
    }

    /** Dismiss without stealing focus from an outside interaction. */
    function close(isReturning = true) {
        setOpen(false);
        if (isReturning) trigger.focus();
    }

    /** Commit an explicit option and return to the filter trigger. */
    function choose(value: string) {
        props.onChange(value);
        close();
    }

    /** Open with the current value highlighted and the search focused. */
    function open() {
        setSearch("");
        setActive(
            Math.max(
                0,
                props.options.findIndex((option) => option.value === props.value),
            ),
        );
        setOpen(true);
        queueMicrotask(() => {
            if (!isOpen() || !panel?.isConnected) return;
            place();
            input?.focus();
            document.getElementById(`${id}-${active()}`)?.scrollIntoView({ block: "nearest" });
        });
    }

    // follow scrolling and dismiss when pointer or focus leaves the picker
    onMount(() => {
        const dismiss = (event: Event) => {
            if (
                isOpen() &&
                event.target instanceof Node &&
                !trigger.contains(event.target) &&
                !panel?.contains(event.target)
            )
                close(false);
        };
        document.addEventListener("pointerdown", dismiss);
        document.addEventListener("focusin", dismiss);
        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);
        window.visualViewport?.addEventListener("resize", place);
        window.visualViewport?.addEventListener("scroll", place);
        onCleanup(() => {
            document.removeEventListener("pointerdown", dismiss);
            document.removeEventListener("focusin", dismiss);
            window.removeEventListener("scroll", place, true);
            window.removeEventListener("resize", place);
            window.visualViewport?.removeEventListener("resize", place);
            window.visualViewport?.removeEventListener("scroll", place);
        });
    });

    return (
        <div class="filter-controls filter-select">
            <button
                type="button"
                ref={trigger}
                aria-label={`${props.label}: ${props.options.find((option) => option.value === props.value)?.label ?? props.value}`}
                aria-haspopup="dialog"
                aria-expanded={isOpen()}
                aria-controls={isOpen() ? `${id}-panel` : undefined}
                onClick={() => (isOpen() ? close() : open())}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        open();
                    }
                }}
            >
                <span>
                    {props.options.find((option) => option.value === props.value)?.label ??
                        props.value}
                </span>
                <ChevronDown size={14} aria-hidden="true" />
            </button>
            <Show when={isOpen()}>
                <Portal mount={trigger.closest("dialog") ?? document.body}>
                    <div
                        ref={panel}
                        id={`${id}-panel`}
                        class="filter-menu__panel"
                        role="dialog"
                        aria-label={`Filter by ${props.label.toLowerCase()}`}
                        style={position()}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                event.preventDefault();
                                event.stopPropagation();
                                close();
                            }
                        }}
                    >
                        <div class="filter-menu__heading">
                            <strong>{props.label}</strong>
                            <button
                                type="button"
                                aria-label="Close filters"
                                title="Close filters"
                                onClick={() => close()}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div class="filter-menu__search">
                            <Search size={16} aria-hidden="true" />
                            <input
                                ref={input}
                                type="text"
                                role="combobox"
                                aria-label={`Search ${props.label.toLowerCase()}`}
                                aria-expanded="true"
                                aria-autocomplete="list"
                                aria-controls={`${id}-options`}
                                aria-activedescendant={
                                    matches()[active()] ? `${id}-${active()}` : undefined
                                }
                                autocomplete="off"
                                placeholder={`Search ${props.label.toLowerCase()}`}
                                value={search()}
                                onInput={(event) => {
                                    setSearch(event.currentTarget.value);
                                    setActive(0);
                                }}
                                onKeyDown={(event) => {
                                    if (event.isComposing) return;
                                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                                        event.preventDefault();
                                        setActive((index) =>
                                            Math.max(
                                                0,
                                                Math.min(
                                                    matches().length - 1,
                                                    index + (event.key === "ArrowDown" ? 1 : -1),
                                                ),
                                            ),
                                        );
                                        document
                                            .getElementById(`${id}-${active()}`)
                                            ?.scrollIntoView({ block: "nearest" });
                                    } else if (event.key === "Enter") {
                                        event.preventDefault();
                                        const option = matches()[active()];
                                        if (option) choose(option.value);
                                    }
                                }}
                            />
                        </div>
                        <div
                            id={`${id}-options`}
                            class="filter-menu__options"
                            role="listbox"
                            aria-label={props.label}
                        >
                            <For each={matches()}>
                                {(option, index) => (
                                    <div
                                        id={`${id}-${index()}`}
                                        role="option"
                                        aria-selected={option.value === props.value}
                                        class="filter-menu__option filter-select__option"
                                        classList={{ "is-active": active() === index() }}
                                        onPointerDown={(event) => event.preventDefault()}
                                        onClick={() => choose(option.value)}
                                    >
                                        <span class="filter-select__check" aria-hidden="true">
                                            <Show when={option.value === props.value}>
                                                <Check size={16} />
                                            </Show>
                                        </span>
                                        <span>{option.label}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                        <Show when={!matches().length}>
                            <p class="filter-menu__empty" role="status">
                                No matches
                            </p>
                        </Show>
                    </div>
                </Portal>
            </Show>
        </div>
    );
}
