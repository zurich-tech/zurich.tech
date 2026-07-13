import { createAsync, useNavigate } from "@solidjs/router";
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";

import { search as searchSite } from "../data/public";

/** One command palette entry. */
type Command = {
    /** Supporting text. */
    description?: string;
    /** Navigation destination. */
    href: string;
    /** Result category. */
    kind: string;
    /** Visible command name. */
    label: string;
    /** Local search terms. */
    terms: string;
};

const commands: Command[] = [
    { href: "/", kind: "page", label: "home", terms: "zurich tech home" },
    { href: "/events", kind: "page", label: "events", terms: "events calendar" },
    { href: "/series", kind: "page", label: "series", terms: "event series" },
    { href: "/members", kind: "page", label: "members", terms: "people members" },
    { href: "/blog", kind: "page", label: "blog", terms: "blog posts" },
    {
        href: "/events/propose",
        kind: "command",
        label: "propose event",
        terms: "new add submit event",
    },
    {
        href: "/series/propose",
        kind: "command",
        label: "start series",
        terms: "new add submit series",
    },
    { href: "/settings", kind: "command", label: "sign in", terms: "account login" },
];

/** Global navigation and public record search. */
export function CommandPalette() {
    const navigate = useNavigate();
    const [query, setQuery] = createSignal("");
    const [selected, setSelected] = createSignal(0);
    const results = createAsync(() => searchSite(query()));
    let dialog!: HTMLDialogElement;
    let input!: HTMLInputElement;

    // combine local commands with indexed public records
    const matches = createMemo(() => {
        const normalized = query().trim().toLowerCase();
        const local = commands.filter((command) => {
            if (normalized.length === 0) {
                return true;
            }

            return `${command.label} ${command.terms}`.includes(normalized);
        });
        const remote = (results() ?? []).map((result) => ({
            ...result,
            terms: `${result.label} ${result.description ?? ""}`.toLowerCase(),
        }));

        return [...local, ...remote];
    });

    // wire global palette shortcuts
    onMount(() => {
        const openPalette = (event: KeyboardEvent) => {
            const isCommand = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
            const isSearch = event.key === "/" && !isEditable(event.target);
            if (!isCommand && !isSearch) {
                return;
            }

            event.preventDefault();
            open();
        };

        window.addEventListener("keydown", openPalette);
        onCleanup(() => window.removeEventListener("keydown", openPalette));
    });

    // open and focus search
    function open() {
        if (!dialog.open) {
            dialog.showModal();
        }
        queueMicrotask(() => input.focus());
    }

    // navigate through results
    function choose(command: Command) {
        dialog.close();
        setQuery("");
        setSelected(0);
        navigate(command.href);
    }

    // handle keyboard selection
    function select(event: KeyboardEvent) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelected((index) => Math.min(index + 1, matches().length - 1));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelected((index) => Math.max(0, index - 1));
        } else if (event.key === "Enter") {
            const command = matches()[selected()];
            if (command !== undefined) {
                event.preventDefault();
                choose(command);
            }
        }
    }

    return (
        <>
            {/* trigger */}
            <button class="command-trigger" onClick={open} type="button">
                [search /]
            </button>

            {/* palette */}
            <dialog
                class="command-palette"
                onClick={(event) => event.target === dialog && dialog.close()}
                ref={dialog}
            >
                <div class="command-palette__frame">
                    {/* search */}
                    <label class="command-palette__input">
                        <span aria-hidden="true">/</span>
                        <span class="sr-only">search zurich.tech</span>
                        <input
                            autocomplete="off"
                            onInput={(event) => {
                                setQuery(event.currentTarget.value);
                                setSelected(0);
                            }}
                            onKeyDown={select}
                            placeholder="search events, series, members, posts..."
                            ref={input}
                            type="search"
                            value={query()}
                        />
                        <button onClick={() => dialog.close()} type="button">
                            [esc]
                        </button>
                    </label>

                    {/* results */}
                    <Show
                        when={matches().length > 0}
                        fallback={<p class="command-palette__empty">no matches</p>}
                    >
                        <ol class="command-palette__results">
                            <For each={matches()}>
                                {(command, index) => (
                                    <li
                                        classList={{
                                            "command-palette__selected": selected() === index(),
                                        }}
                                    >
                                        <button
                                            onClick={() => choose(command)}
                                            onMouseEnter={() => setSelected(index())}
                                            type="button"
                                        >
                                            <span class="command-palette__indicator">{">"}</span>
                                            <span class="command-palette__kind">
                                                [{command.kind}]
                                            </span>
                                            <span class="command-palette__result">
                                                <strong>{command.label}</strong>
                                                <Show when={command.description}>
                                                    <span>{command.description}</span>
                                                </Show>
                                            </span>
                                        </button>
                                    </li>
                                )}
                            </For>
                        </ol>
                    </Show>
                </div>
            </dialog>
        </>
    );
}

/** Whether a keyboard event belongs to an editable control. */
function isEditable(target: EventTarget | null) {
    return target instanceof HTMLElement && /^(input|textarea|select)$/i.test(target.tagName);
}
