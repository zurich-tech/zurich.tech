import { createEffect, createMemo, createSignal, createUniqueId, For, Show } from "solid-js";
import { X } from "lucide-solid";
import "./selection.css";

/** A catalogue choice with optional search aliases. */
export type SelectionOption<Value extends string = string> = {
    value: Value;
    label: string;
    aliases?: string;
};

/** Search catalogue values without accepting arbitrary text as an answer. */
export function Selection<Value extends string>(props: {
    label: string;
    name: string;
    options: readonly SelectionOption<Value>[];
    values: Value[];
    /** Bound rendered results for large searchable catalogues. */
    limit?: number;
    isMultiple?: boolean;
    onChange?: (values: Value[]) => void;
}) {
    const id = createUniqueId();
    const [selected, setSelected] = createSignal<Value[]>([]);
    const [search, setSearch] = createSignal("");
    const [isOpen, setOpen] = createSignal(false);
    const [active, setActive] = createSignal(0);
    const matches = createMemo(() =>
        props.options
            .filter(
                (option) =>
                    !selected().includes(option.value) &&
                    normalise(`${option.label} ${option.value} ${option.aliases ?? ""}`).includes(
                        normalise(search()),
                    ),
            )
            .slice(0, props.limit),
    );

    // hydrate stored selections separately from unfinished searches
    createEffect(() => {
        setSelected([...props.values]);
        setSearch("");
        setOpen(false);
        setActive(0);
    });

    /** Publish only explicit selections and removals. */
    function update(values: Value[]) {
        setSelected(values);
        props.onChange?.(values);
        setSearch("");
        setActive(0);
    }

    /** Select an entry while retaining keyboard focus. */
    function choose(value: Value) {
        update(props.isMultiple ? [...selected(), value] : [value]);
        setOpen(!!props.isMultiple);
    }

    return (
        <div class="selection">
            <label for={id}>{props.label}</label>
            <Show when={!props.isMultiple && !selected().length}>
                <input type="hidden" name={props.name} value="" />
            </Show>
            <Show when={selected().length}>
                <ul class="selection-values" aria-label={`Selected: ${props.label}`}>
                    <For each={selected()}>
                        {(value) => (
                            <li>
                                <input type="hidden" name={props.name} value={value} />
                                <span>
                                    {props.options.find((option) => option.value === value)
                                        ?.label ?? value}
                                </span>
                                <button
                                    type="button"
                                    title="Remove"
                                    aria-label={`Remove ${props.options.find((option) => option.value === value)?.label ?? value}`}
                                    onClick={() =>
                                        update(selected().filter((item) => item !== value))
                                    }
                                >
                                    <X size={14} aria-hidden="true" />
                                </button>
                            </li>
                        )}
                    </For>
                </ul>
            </Show>
            <div class="selection-search">
                <input
                    id={id}
                    class="field__control"
                    type="text"
                    role="combobox"
                    autocomplete="off"
                    placeholder="Search…"
                    aria-autocomplete="list"
                    aria-expanded={isOpen()}
                    aria-controls={`${id}-options`}
                    aria-activedescendant={
                        isOpen() && matches().length ? `${id}-${active()}` : undefined
                    }
                    value={search()}
                    onFocus={() => {
                        setOpen(true);
                        setActive(0);
                    }}
                    onBlur={() => {
                        setOpen(false);
                        setSearch("");
                    }}
                    onInput={(event) => {
                        setSearch(event.currentTarget.value);
                        setActive(0);
                        setOpen(true);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            setOpen(true);
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
                            if (isOpen() && matches()[active()]) choose(matches()[active()].value);
                        } else if (event.key === "Escape") {
                            event.preventDefault();
                            setOpen(false);
                            setSearch("");
                        }
                    }}
                />
                <Show when={isOpen()}>
                    <ul
                        id={`${id}-options`}
                        role="listbox"
                        aria-label={props.label}
                        class="selection-options"
                    >
                        <For each={matches()}>
                            {(option, index) => (
                                <li
                                    id={`${id}-${index()}`}
                                    role="option"
                                    aria-selected={active() === index()}
                                    onMouseDown={(event) => event.preventDefault()}
                                    onMouseMove={() => setActive(index())}
                                    onClick={() => choose(option.value)}
                                >
                                    {option.label}
                                </li>
                            )}
                        </For>
                        <Show when={!matches().length}>
                            <li role="presentation">No matches</li>
                        </Show>
                    </ul>
                </Show>
            </div>
        </div>
    );
}

/** Match accents and case consistently. */
function normalise(value: string) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}
