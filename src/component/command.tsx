import { createAsync, useNavigate } from "@solidjs/router";
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";

import type { SearchResult } from "../data/public";
import { search as searchSite } from "../data/public";
import { searchExcerpt, searchScore, searchTerms } from "../search";
import { Highlight } from "./highlight";

const resultLimit = 12;

/** One command palette entry. */
type Command = {
    /** Supporting searchable text. */
    description?: string;
    /** Navigation destination. */
    href: string;
    /** Result category. */
    kind: string;
    /** Visible command name. */
    label: string;
    /** Additional searchable text. */
    text: string;
};

/** One ranked command and its query context. */
type CommandMatch = {
    /** The matched command. */
    command: Command;
    /** A compact passage around the first content match. */
    excerpt: string;
    /** The normalized query terms. */
    terms: readonly string[];
};

const commands: readonly Command[] = [
    { href: "/", kind: "page", label: "home", text: "zurich tech" },
    { href: "/events", kind: "page", label: "events", text: "calendar" },
    { href: "/members", kind: "page", label: "members", text: "people directory" },
    { href: "/news", kind: "page", label: "news", text: "articles" },
    {
        href: "/events/propose",
        kind: "command",
        label: "propose event",
        text: "new add submit event",
    },
    {
        href: "/series/propose",
        kind: "command",
        label: "start series",
        text: "new add submit series",
    },
    { href: "/sign-in", kind: "command", label: "sign in", text: "account login github" },
];

/** Global navigation and public record search. */
export function CommandPalette() {
    const navigate = useNavigate();
    const [query, setQuery] = createSignal("");
    const [selected, setSelected] = createSignal(0);
    const remote = createAsync(() => searchPublic(query()));
    const matches = createMemo(() =>
        matchCommands([...commands, ...remoteCommands(remote())], query()),
    );
    let dialog!: HTMLDialogElement;
    let input!: HTMLInputElement;

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

    // open a clean palette and focus search
    function open() {
        setQuery("");
        setSelected(0);
        if (!dialog.open) {
            dialog.showModal();
        }

        queueMicrotask(() => input.focus());
    }

    // close the palette and navigate
    function choose(command: Command) {
        dialog.close();
        setQuery("");
        setSelected(0);
        navigate(command.href);
    }

    // update the query and reset selection
    function search(value: string) {
        setQuery(value);
        setSelected(0);
    }

    // move the active result and keep it visible
    function moveSelection(index: number) {
        setSelected(index);
        queueMicrotask(() => {
            document.getElementById(`search-result-${index}`)?.scrollIntoView({ block: "nearest" });
        });
    }

    // handle keyboard selection
    function select(event: KeyboardEvent) {
        const count = matches().length;

        // next result
        if (event.key === "ArrowDown") {
            event.preventDefault();
            moveSelection((selected() + 1) % Math.max(count, 1));
        }
        // previous result
        else if (event.key === "ArrowUp") {
            event.preventDefault();
            moveSelection((selected() - 1 + Math.max(count, 1)) % Math.max(count, 1));
        }
        // choose active result
        else if (event.key === "Enter") {
            const command = matches()[selected()]?.command;
            if (command !== undefined) {
                event.preventDefault();
                choose(command);
            }
        }
    }

    return (
        <>
            {/* trigger */}
            <button aria-label="search" class="command-trigger" onClick={open} type="button">
                [<span class="command-trigger__label">search </span>/]
            </button>

            {/* palette */}
            <Portal>
                <dialog
                    aria-label="search zurich.tech"
                    class="command-palette"
                    onClick={(event) => event.target === dialog && dialog.close()}
                    ref={dialog}
                >
                    <div class="command-palette__frame">
                        {/* search */}
                        <label class="command-palette__input">
                            <span aria-hidden="true">{">"}</span>
                            <input
                                aria-activedescendant={
                                    matches().length === 0
                                        ? undefined
                                        : `search-result-${selected()}`
                                }
                                aria-autocomplete="list"
                                aria-controls="search-results"
                                aria-expanded="true"
                                aria-label="search query"
                                autocomplete="off"
                                onInput={(event) => search(event.currentTarget.value)}
                                onKeyDown={select}
                                placeholder="search everything"
                                ref={input}
                                role="combobox"
                                type="search"
                                value={query()}
                            />
                            <button
                                aria-label="close search"
                                onClick={() => dialog.close()}
                                type="button"
                            >
                                [esc]
                            </button>
                        </label>

                        {/* results */}
                        <ol class="command-palette__results" id="search-results" role="listbox">
                            <For each={matches()}>
                                {(match, index) => (
                                    <li
                                        classList={{
                                            "command-palette__selected": selected() === index(),
                                        }}
                                        role="none"
                                    >
                                        <button
                                            aria-selected={selected() === index()}
                                            id={`search-result-${index()}`}
                                            onClick={() => choose(match.command)}
                                            onMouseMove={() => setSelected(index())}
                                            role="option"
                                            type="button"
                                        >
                                            <span
                                                aria-hidden="true"
                                                class="command-palette__indicator"
                                            >
                                                {selected() === index() ? ">" : ""}
                                            </span>
                                            <span class="command-palette__kind">
                                                [
                                                <Highlight
                                                    text={match.command.kind}
                                                    terms={match.terms}
                                                />
                                                ]
                                            </span>
                                            <span class="command-palette__result">
                                                <strong>
                                                    <Highlight
                                                        text={match.command.label}
                                                        terms={match.terms}
                                                    />
                                                </strong>
                                                <Show when={match.excerpt !== ""}>
                                                    <span>
                                                        <Highlight
                                                            text={match.excerpt}
                                                            terms={match.terms}
                                                        />
                                                    </span>
                                                </Show>
                                            </span>
                                        </button>
                                    </li>
                                )}
                            </For>
                        </ol>

                        {/* empty */}
                        <Show when={matches().length === 0}>
                            <p class="command-palette__empty">no matches</p>
                        </Show>
                    </div>
                </dialog>
            </Portal>
        </>
    );
}

/** Search public records once the query is meaningful. */
async function searchPublic(query: string): Promise<SearchResult[]> {
    const text = query.trim();
    if (text.length < 2) {
        return [];
    }

    return await searchSite(text);
}

/** Convert public records into palette commands. */
function remoteCommands(results: SearchResult[] | undefined): Command[] {
    return (results ?? []).map((result) => ({
        description: result.description,
        href: result.href,
        kind: result.kind,
        label: result.label,
        text: result.description ?? "",
    }));
}

/** Rank commands that contain every query term. */
function matchCommands(entries: readonly Command[], query: string): readonly CommandMatch[] {
    const terms = searchTerms(query);

    return entries
        .filter(
            (command) => terms.length > 0 || command.kind === "page" || command.kind === "command",
        )
        .map((command) => ({
            command,
            score: searchScore(
                { context: command.kind, label: command.label, text: command.text },
                terms,
            ),
        }))
        .filter((match) => match.score >= 0)
        .sort(
            (left, right) =>
                right.score - left.score || left.command.label.localeCompare(right.command.label),
        )
        .slice(0, resultLimit)
        .map(({ command }) => ({
            command,
            excerpt:
                terms.length === 0 ? "" : searchExcerpt(command.description ?? command.text, terms),
            terms,
        }));
}

/** Return whether the keyboard event originated in editable content. */
function isEditable(target: EventTarget | null) {
    return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
    );
}
