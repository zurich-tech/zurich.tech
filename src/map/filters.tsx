import { Check, ChevronDown, Search, Shapes, Tags, X } from "lucide-solid";
import {
    createEffect,
    createMemo,
    createSignal,
    createUniqueId,
    For,
    onCleanup,
    onMount,
    Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { organisationKinds } from "../../convex/organisations/kinds";
import { descendantTopics } from "../../convex/topics/hierarchy";
import { selectSpecificTopic } from "../topics/selection";
import "./filters.css";

/** A selectable catalogue topic, retaining archived selections for removal. */
export type MapFilterTopic = { slug: string; name: string; parent?: string; isActive: boolean };

/** Controlled map filters; counts are keyed by topic slug. */
export type MapFiltersProps = {
    /** Selected organisation kind, or all. */
    category: string;
    /** Explicit topic selections, matched with OR semantics by the caller. */
    topics: string[];
    /** Authoritative topic hierarchy. */
    catalogue: readonly MapFilterTopic[];
    /** Optional result counts by topic slug. */
    counts?: Readonly<Record<string, number>>;
    /** Publish the complete selection without changing the map directly. */
    onChange: (category: string, topics: string[]) => void;
    /** Suspend competing map previews while a picker is open. */
    onOpenChange: (isOpen: boolean) => void;
};

/** Present compact type and searchable topic filters with removable selections. */
export function MapFilters(props: MapFiltersProps) {
    const id = createUniqueId();
    const [open, setOpen] = createSignal<"type" | "topics">();
    const [search, setSearch] = createSignal("");
    const [active, setActive] = createSignal(0);
    const [position, setPosition] = createSignal({
        left: "8px",
        top: "8px",
        width: "280px",
        "max-height": "300px",
        transform: "none",
    });
    let controls!: HTMLDivElement;
    let panel: HTMLDivElement | undefined;
    let typeButton!: HTMLButtonElement;
    let topicsButton!: HTMLButtonElement;
    let input: HTMLInputElement | undefined;
    const kinds = [
        { slug: "all", name: "All types" },
        ...Object.entries(organisationKinds).map(([slug, name]) => ({ slug, name })),
    ];
    const names = createMemo(
        () => new Map(props.catalogue.map((topic) => [topic.slug, topic.name])),
    );
    const groups = createMemo(() => {
        // retain hierarchy context when matching either a root or a child name
        const query = search().trim().toLocaleLowerCase();
        return props.catalogue
            .filter((topic) => !topic.parent)
            .map((root) => {
                const family = descendantTopics(root.slug, props.catalogue);
                const entries = props.catalogue.filter(
                    (topic) =>
                        family.has(topic.slug) &&
                        (topic.isActive || props.topics.includes(topic.slug)) &&
                        (!query ||
                            `${root.name} ${topic.name} ${topic.slug}`
                                .toLocaleLowerCase()
                                .includes(query)),
                );
                entries.sort((left, right) =>
                    left.slug === root.slug
                        ? -1
                        : right.slug === root.slug
                          ? 1
                          : left.name.localeCompare(right.name),
                );

                return { root, entries };
            })
            .filter((group) => group.entries.length);
    });
    const matches = createMemo(() => groups().flatMap((group) => group.entries));

    /** Dismiss and optionally return focus to the initiating button. */
    function close(isReturning = true) {
        const trigger = open() === "type" ? typeButton : topicsButton;
        setOpen(undefined);
        if (isReturning) trigger.focus();
    }

    /** Fit the floating panel above or below its trigger within the visible viewport. */
    function place() {
        if (!open()) return;
        const bounds = (open() === "type" ? typeButton : topicsButton).getBoundingClientRect();
        const viewport = window.visualViewport;
        const left = viewport?.offsetLeft ?? 0;
        const top = viewport?.offsetTop ?? 0;
        const width = viewport?.width ?? window.innerWidth;
        const height = viewport?.height ?? window.innerHeight;
        const panelWidth = Math.min(320, Math.max(0, width - 16));
        const below = Math.max(0, top + height - bounds.bottom - 12);
        const above = Math.max(0, bounds.top - top - 12);
        const isBelow = below >= Math.min(320, above);
        const available = Math.min(400, isBelow ? below : above);
        setPosition({
            left: `${Math.max(left + 8, Math.min(bounds.left, left + width - panelWidth - 8))}px`,
            top: `${isBelow ? bounds.bottom + 4 : bounds.top - 4}px`,
            width: `${panelWidth}px`,
            "max-height": `${available}px`,
            transform: isBelow ? "none" : "translateY(-100%)",
        });
    }

    /** Toggle only known topics through the hierarchy helper; preserve removable unknown values. */
    function toggle(slug: string) {
        const selected = props.topics.includes(slug)
            ? props.topics.filter((value) => value !== slug)
            : [
                  ...props.topics.filter((value) => !names().has(value)),
                  ...selectSpecificTopic(
                      props.topics.filter((value) => names().has(value)),
                      slug,
                      props.catalogue,
                  ),
              ];
        props.onChange(props.category, selected);
    }

    /** Open one panel and reset its temporary search state. */
    function show(which: "type" | "topics") {
        if (open() === which) close();
        else {
            setSearch("");
            setActive(0);
            setOpen(which);
        }
    }

    // focus only after the conditional portal has mounted
    createEffect(() => {
        const current = open();
        props.onOpenChange(Boolean(current));
        if (current)
            queueMicrotask(() => {
                if (open() !== current || !panel?.isConnected) return;
                place();
                if (current === "topics") input?.focus();
                else
                    (
                        panel.querySelector<HTMLInputElement>("input:checked") ??
                        panel.querySelector<HTMLInputElement>("input")
                    )?.focus();
            });
    });

    // keep the active descendant valid as search results or the catalogue change
    createEffect(() => {
        const length = matches().length;
        setActive((index) => Math.max(0, Math.min(index, length - 1)));
    });
    // follow the mobile sheet when selections expand the results and chips
    createEffect(() => {
        props.category;
        props.topics;
        search();
        if (open()) queueMicrotask(place);
    });
    onMount(() => {
        /** Dismiss when a pointer or keyboard focus leaves both controls and panel. */
        const dismiss = (event: Event) => {
            if (
                open() &&
                event.target instanceof Node &&
                !controls.contains(event.target) &&
                !panel?.contains(event.target)
            )
                close(false);
        };
        document.addEventListener("pointerdown", dismiss);
        document.addEventListener("focusin", dismiss);
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        window.visualViewport?.addEventListener("resize", place);
        window.visualViewport?.addEventListener("scroll", place);
        onCleanup(() => {
            document.removeEventListener("pointerdown", dismiss);
            document.removeEventListener("focusin", dismiss);
            window.removeEventListener("resize", place);
            window.removeEventListener("scroll", place, true);
            window.visualViewport?.removeEventListener("resize", place);
            window.visualViewport?.removeEventListener("scroll", place);
        });
    });

    return (
        <div class="map-filter-controls" ref={controls}>
            {/* Filter triggers */}
            <div class="map-filters__controls">
                <button
                    type="button"
                    ref={typeButton}
                    aria-haspopup="dialog"
                    aria-expanded={open() === "type"}
                    aria-controls={open() === "type" ? `${id}-panel` : undefined}
                    onClick={() => show("type")}
                >
                    <Shapes size={15} aria-hidden="true" /> Type{" "}
                    <ChevronDown size={14} aria-hidden="true" />
                </button>
                <button
                    type="button"
                    ref={topicsButton}
                    aria-haspopup="dialog"
                    aria-expanded={open() === "topics"}
                    aria-controls={open() === "topics" ? `${id}-panel` : undefined}
                    onClick={() => show("topics")}
                >
                    <Tags size={15} aria-hidden="true" /> Topics{" "}
                    <Show when={props.topics.length}>
                        <span class="map-filters__count">{props.topics.length}</span>
                    </Show>
                    <ChevronDown size={14} aria-hidden="true" />
                </button>
            </div>
            {/* Explicit selections remain visible when the panel is closed */}
            <Show when={props.category !== "all" || props.topics.length}>
                <ul class="map-filters__chips" aria-label="Selected filters">
                    <Show when={props.category !== "all"}>
                        <li>
                            <span>
                                {kinds.find((kind) => kind.slug === props.category)?.name ??
                                    props.category}
                            </span>
                            <button
                                type="button"
                                aria-label="Remove type filter"
                                title="Remove type filter"
                                onClick={() => {
                                    props.onChange("all", props.topics);
                                    typeButton.focus();
                                }}
                            >
                                <X size={14} aria-hidden="true" />
                            </button>
                        </li>
                    </Show>
                    <For each={props.topics}>
                        {(slug) => (
                            <li>
                                <span>{names().get(slug) ?? slug}</span>
                                <button
                                    type="button"
                                    aria-label={`Remove ${names().get(slug) ?? slug}`}
                                    title={`Remove ${names().get(slug) ?? slug}`}
                                    onClick={() => {
                                        props.onChange(
                                            props.category,
                                            props.topics.filter((value) => value !== slug),
                                        );
                                        topicsButton.focus();
                                    }}
                                >
                                    <X size={14} aria-hidden="true" />
                                </button>
                            </li>
                        )}
                    </For>
                </ul>
            </Show>
            {/* Render outside clipped map panels without changing the caller's layout */}
            <Show when={open()}>
                <Portal>
                    <div
                        ref={panel}
                        id={`${id}-panel`}
                        class="map-filters__panel"
                        role="dialog"
                        aria-label={open() === "type" ? "Filter by type" : "Filter by topics"}
                        style={position()}
                        onKeyDown={(event) => {
                            if (event.key === "Escape") {
                                event.preventDefault();
                                event.stopPropagation();
                                close();
                            }
                        }}
                    >
                        <div class="map-filters__heading">
                            <strong>{open() === "type" ? "Type" : "Topics"}</strong>
                            <button
                                type="button"
                                title="Close filters"
                                aria-label="Close filters"
                                onClick={() => close()}
                            >
                                <X size={16} aria-hidden="true" />
                            </button>
                        </div>
                        <Show
                            when={open() === "type"}
                            fallback={
                                <>
                                    <div class="map-filters__search">
                                        <Search size={16} aria-hidden="true" />
                                        <input
                                            ref={input}
                                            type="text"
                                            role="combobox"
                                            aria-label="Search topics"
                                            aria-expanded="true"
                                            aria-autocomplete="list"
                                            aria-controls={`${id}-options`}
                                            aria-activedescendant={
                                                matches()[active()]
                                                    ? `${id}-topic-${matches()[active()].slug}`
                                                    : undefined
                                            }
                                            autocomplete="off"
                                            placeholder="Search topics"
                                            value={search()}
                                            onInput={(event) => {
                                                setSearch(event.currentTarget.value);
                                                setActive(0);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.isComposing) return;
                                                if (
                                                    event.key === "ArrowDown" ||
                                                    event.key === "ArrowUp"
                                                ) {
                                                    event.preventDefault();
                                                    setActive((index) =>
                                                        Math.max(
                                                            0,
                                                            Math.min(
                                                                matches().length - 1,
                                                                index +
                                                                    (event.key === "ArrowDown"
                                                                        ? 1
                                                                        : -1),
                                                            ),
                                                        ),
                                                    );
                                                    document
                                                        .getElementById(
                                                            `${id}-topic-${matches()[active()]?.slug}`,
                                                        )
                                                        ?.scrollIntoView({ block: "nearest" });
                                                } else if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    const topic = matches()[active()];
                                                    if (topic) toggle(topic.slug);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div
                                        id={`${id}-options`}
                                        class="map-filters__options"
                                        role="listbox"
                                        aria-label="Topics"
                                        aria-multiselectable="true"
                                    >
                                        <For each={groups()}>
                                            {(group) => (
                                                <div role="group" aria-label={group.root.name}>
                                                    <For each={group.entries}>
                                                        {(topic) => (
                                                            <div
                                                                id={`${id}-topic-${topic.slug}`}
                                                                role="option"
                                                                aria-selected={props.topics.includes(
                                                                    topic.slug,
                                                                )}
                                                                class="map-filters__option"
                                                                classList={{
                                                                    "is-active":
                                                                        matches()[active()]
                                                                            ?.slug === topic.slug,
                                                                    "is-child":
                                                                        topic.slug !==
                                                                        group.root.slug,
                                                                }}
                                                                onPointerDown={(event) =>
                                                                    event.preventDefault()
                                                                }
                                                                onClick={() => {
                                                                    toggle(topic.slug);
                                                                    input?.focus();
                                                                }}
                                                            >
                                                                <span
                                                                    class="map-filters__check"
                                                                    aria-hidden="true"
                                                                >
                                                                    <Show
                                                                        when={props.topics.includes(
                                                                            topic.slug,
                                                                        )}
                                                                    >
                                                                        <Check size={12} />
                                                                    </Show>
                                                                </span>
                                                                <span>{topic.name}</span>
                                                                <Show
                                                                    when={
                                                                        props.counts?.[
                                                                            topic.slug
                                                                        ] !== undefined
                                                                    }
                                                                >
                                                                    <span class="map-filters__count">
                                                                        {props.counts?.[topic.slug]}
                                                                    </span>
                                                                </Show>
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                    <Show when={!matches().length}>
                                        <p class="map-filters__empty" role="status">
                                            No topics found
                                        </p>
                                    </Show>
                                </>
                            }
                        >
                            <fieldset class="map-filters__types">
                                <legend class="map-filters__sr-only">Type</legend>
                                <For each={kinds}>
                                    {(kind) => (
                                        <label>
                                            <input
                                                type="radio"
                                                name={`${id}-kind`}
                                                value={kind.slug}
                                                checked={props.category === kind.slug}
                                                onChange={() =>
                                                    props.onChange(kind.slug, props.topics)
                                                }
                                            />
                                            <span>{kind.name}</span>
                                        </label>
                                    )}
                                </For>
                            </fieldset>
                        </Show>
                    </div>
                </Portal>
            </Show>
        </div>
    );
}
