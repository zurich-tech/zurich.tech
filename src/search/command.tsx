import { SearchIcon, SearchResult, type Match } from "./result";
import { SearchNotice } from "./notice";
import { errorMessage } from "../components/errors";
import { FilterPills } from "../components/filter-pills";
import { useCatalogue } from "./catalogue";
import { search as searchSite } from "./queries";
import { site } from "../app/site";
import { useNavigate } from "@solidjs/router";
import {
    createMemo,
    createResource,
    createSignal,
    createEffect,
    For,
    Show,
    onMount,
    onCleanup,
} from "solid-js";
import { useAccess } from "../auth/edit";
import { memberClient } from "../auth/convex";
import { api } from "../../convex/_generated/api";
import { useCommands, type Command } from "./actions";
import {
    searchKinds,
    type SearchKind,
    searchTerms,
    searchScore,
    searchExcerpt,
    highlightParts,
} from "../../convex/search/ranking";
import "./command.css";

type Scope = "All" | "Site" | "Commands" | SearchKind;

/** Unified public search and permission-aware commands, with native dialog focus containment. */
export function CommandPalette() {
    const navigate = useNavigate();
    const access = useAccess();
    const registry = useCommands();
    const catalogue = useCatalogue();
    const [isOpen, setOpen] = createSignal(false);
    const [query, setQuery] = createSignal("");
    const [scope, setScope] = createSignal<Scope>("All");
    const [requested, setRequested] = createSignal("");
    const [selectedId, setSelectedId] = createSignal<string>();
    const [error, setError] = createSignal("");
    let dialog!: HTMLDialogElement;
    let input!: HTMLInputElement;
    let trigger!: HTMLButtonElement;
    let returnFocus: HTMLElement | undefined;

    // prevent background scrolling while the modal owns keyboard focus
    createEffect(() => {
        if (!isOpen()) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        onCleanup(() => {
            document.body.style.overflow = previous;
        });
    });

    // debounce network work, retaining immediate local command matching
    createEffect(() => {
        const text = query().trim();
        const timer = setTimeout(() => setRequested(text), 100);
        onCleanup(() => clearTimeout(timer));
    });
    const contentScope = () => scope() !== "Site" && scope() !== "Commands";
    const catalogueScope = () => scope() === "All" || scope() === "Events" || scope() === "Series";
    const serverScope = () => contentScope() && scope() !== "Events" && scope() !== "Series";
    const [results, { refetch }] = createResource(
        () =>
            isOpen() && serverScope() && requested().length >= 2
                ? {
                      text: requested(),
                      kind: scope() === "All" ? undefined : (scope() as SearchKind),
                  }
                : false,
        async ({ text, kind }) => ({
            text,
            kind,
            items: await searchSite(
                text,
                kind ? [kind] : ["People", "Organisations", "Jobs", "News"],
            ),
        }),
    );
    const [drafts, { refetch: retryDrafts }] = createResource(
        () => (isOpen() && access.key() ? access.key() : false),
        async (key) => ({
            key,
            items: await (await memberClient()).query(api.events.workspace.planning, {}),
        }),
    );
    const commands = createMemo<Command[]>(() => [
        ...[
            ["Home", "/"],
            ["Events", "/events"],
            ["Series", "/series"],
            ["People", "/members"],
            ["Organisations", "/organisations"],
            ["Jobs", "/jobs"],
            ["News", "/news"],
            ["Photos", "/photos"],
            ["Map", "/map"],
            ["Sponsor", "/sponsor"],
            ["Stats", "/stats"],
            ["About", "/about"],
            ["Legal", "/legal"],
        ].map(([label, href]) => ({ id: href, label, href, group: "Pages" })),
        {
            id: "theme",
            label: "Change theme",
            keywords: "dark light appearance",
            group: "Preferences",
            run: () => {
                window.dispatchEvent(new CustomEvent("theme-cycle"));
            },
        },
        {
            id: "suggest",
            label: "Suggest an event",
            href: "/contribute#events",
            group: "Contribute",
        },
        {
            id: "suggest-news",
            label: "Suggest a story",
            href: site.socials.discord,
            group: "Contribute",
        },
        {
            id: "account",
            label: access.account.user() ? "Account settings" : "Sign in",
            href: access.account.user() ? "/settings" : "/sign-in",
            group: "Account",
        },
        ...(access.canCreate()
            ? [{ id: "new-event", label: "New event", href: "/submit", group: "Create" }]
            : []),
        ...(access.current()?.isAdmin
            ? [
                  "Events",
                  "Series",
                  "News",
                  "Organisations",
                  "Jobs",
                  "Sponsors",
                  "Access",
                  "Email",
              ].map((label) => ({
                  id: `admin-${label}`,
                  label: `Manage ${label.toLowerCase()}`,
                  href: `/admin?section=${label.toLowerCase()}`,
                  group: "Admin",
              }))
            : []),
        ...registry.items().map((command) => ({ ...command, group: "This page" })),
    ]);
    const matches = createMemo<Match[]>(() => {
        // the closed dialog has no results on either side of hydration
        if (!isOpen()) return [];
        const terms = searchTerms(query());
        const local = commands()
            .map((command) => ({
                command,
                score: searchScore(
                    {
                        label: command.label,
                        context: command.group,
                        text: `${command.description ?? ""} ${command.keywords ?? ""}`,
                    },
                    terms,
                ),
            }))
            .filter(({ command, score }) => {
                if (score < 0) return false;
                if (scope() === "Site") return command.group === "Pages";
                if (scope() === "Commands") return command.group !== "Pages";
                if (scope() !== "All") return false;
                if (terms.length) return true;
                return (
                    command.group === "This page" ||
                    ["suggest", "suggest-news", "new-event"].includes(command.id)
                );
            })
            .sort((a, b) => b.score - a.score)
            .map(({ command }) => ({
                command,
                labelParts: highlightParts(command.label, terms),
                descriptionParts: highlightParts(command.description ?? "", terms),
            }));
        const localRecords =
            contentScope() && terms.length
                ? catalogue.search(query(), scope() === "All" ? undefined : (scope() as SearchKind))
                : [];
        const remoteRecords =
            contentScope() &&
            !results.error &&
            results()?.kind === (scope() === "All" ? undefined : scope()) &&
            results()?.text === query().trim()
                ? results()!.items
                : [];
        const remote: Match[] = [...localRecords, ...remoteRecords].map((item) => ({
            command: { id: item.href, label: item.label, href: item.href, group: item.kind },
            labelParts: item.labelParts,
            descriptionParts: item.descriptionParts,
            startsAt: item.startsAt,
            detail: item.detail,
            image: item.image,
        }));
        const featured: Match[] =
            !terms.length && !catalogue.error() && (scope() === "All" || scope() === "Events")
                ? catalogue.upcoming().map((item) => ({
                      command: {
                          id: item.href,
                          href: item.href,
                          label: item.label,
                          group: "Coming up",
                      },
                      labelParts: item.labelParts,
                      descriptionParts: [],
                      startsAt: item.startsAt,
                      detail: item.detail,
                  }))
                : [];
        const privateItems =
            scope() === "All" &&
            terms.length &&
            !!access.key() &&
            !drafts.error &&
            drafts()?.key === access.key()
                ? drafts()!
                      .items.filter(
                          (item) =>
                              searchScore(
                                  {
                                      label: item.title,
                                      context: "Drafts",
                                      text: item.summary ?? "",
                                  },
                                  terms,
                              ) >= 0,
                      )
                      .slice(0, 5)
                      .map((item) => ({
                          command: {
                              id: item.href,
                              label: item.title,
                              href: item.href,
                              group: "Drafts",
                          } as Command,
                          labelParts: highlightParts(item.title, terms),
                          descriptionParts: highlightParts(
                              searchExcerpt(item.summary ?? "", terms),
                              terms,
                          ),
                      }))
                : [];
        const collections =
            query().trim().length >= 2
                ? [
                      ["Events", "/events"],
                      ["Series", "/series"],
                      ["People", "/members"],
                      ["Organisations", "/organisations"],
                      ["Jobs", "/jobs"],
                      ["News", "/news"],
                  ]
                      .filter(([label]) => remote.some((item) => item.command.group === label))
                      .map(([label, href]) => ({
                          command: {
                              id: `all-${href}`,
                              label: `View all in ${label.toLowerCase()}`,
                              href: `${href}?q=${encodeURIComponent(query().trim())}`,
                              group: label,
                          } as Command,
                          labelParts: highlightParts(`View all in ${label.toLowerCase()}`, terms),
                          descriptionParts: [],
                      }))
                : [];
        // keep collection shortcuts with their results; actions follow content when searching
        const groups = [
            "This page",
            "Coming up",
            "Events",
            "Series",
            "News",
            "People",
            "Organisations",
            "Jobs",
            "Drafts",
            "Pages",
            "Create",
            "Contribute",
            "Account",
            "Preferences",
            "Admin",
        ];
        return [...featured, ...local, ...remote, ...privateItems, ...collections].sort(
            (a, b) => groups.indexOf(a.command.group) - groups.indexOf(b.command.group),
        );
    });

    // collection shortcuts are navigation, not additional search matches
    const resultCount = createMemo(
        () => matches().filter((item) => !item.command.id.startsWith("all-")).length,
    );

    // preserve a chosen row as network results arrive; reset only for a new search
    const selected = () =>
        Math.max(
            0,
            matches().findIndex((item) => item.command.id === selectedId()),
        );
    const select = (index: number) => setSelectedId(matches()[index]?.command.id);
    createEffect(() => {
        query();
        scope();
        setSelectedId(undefined);
    });
    /** Close the palette and restore focus. */
    function close() {
        dialog.close();
        setOpen(false);
        (returnFocus?.isConnected ? returnFocus : trigger).focus();
    }
    /** Reset the palette and focus its search field. */
    function open() {
        returnFocus =
            document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        setQuery("");
        setScope("All");
        setRequested("");
        setError("");
        setOpen(true);
        dialog.showModal();
        input.focus();
    }
    /** Run the selected command and display any failure. */
    async function choose(command: Command) {
        close();
        try {
            if (command.href) {
                if (command.href.startsWith("/")) navigate(command.href);
                else window.location.assign(command.href);
            } else await command.run?.();
        } catch (caught) {
            setError(errorMessage(caught, "Could not complete the action."));
            setOpen(true);
            dialog.showModal();
            input.focus();
        }
    }
    /** Handle keyboard selection and command execution. */
    function key(event: KeyboardEvent) {
        if (event.isComposing) return;
        const count = matches().length;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            select(
                (selected() + (event.key === "ArrowDown" ? 1 : -1) + Math.max(count, 1)) %
                    Math.max(count, 1),
            );
            document.getElementById(`palette-${selected()}`)?.scrollIntoView({ block: "nearest" });
        } else if (event.key === "Enter" && matches()[selected()]) {
            event.preventDefault();
            void choose(matches()[selected()].command);
        }
    }
    onMount(() => {
        const shortcut = (event: KeyboardEvent) => {
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === "k" &&
                !event.isComposing
            ) {
                event.preventDefault();
                isOpen() ? close() : open();
            }
        };
        window.addEventListener("keydown", shortcut);
        onCleanup(() => window.removeEventListener("keydown", shortcut));
    });
    return (
        <>
            <button
                ref={trigger}
                class="search-trigger"
                type="button"
                aria-label="Search"
                title="Search (⌘K / Ctrl K)"
                aria-haspopup="dialog"
                onClick={open}
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    aria-hidden="true"
                >
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m16 16 5 5" />
                </svg>
            </button>
            <dialog
                ref={dialog}
                class="search-dialog"
                aria-label="Search and actions"
                onCancel={(event) => {
                    event.preventDefault();
                    close();
                }}
                onClick={(event) => {
                    if (event.target === dialog) close();
                }}
            >
                <div class="search-input">
                    <SearchIcon />
                    <input
                        ref={input}
                        autofocus
                        type="search"
                        role="combobox"
                        aria-label="Search and actions"
                        aria-expanded={isOpen()}
                        aria-controls="palette-results"
                        aria-autocomplete="list"
                        aria-activedescendant={
                            matches().length ? `palette-${selected()}` : undefined
                        }
                        maxlength="200"
                        placeholder={
                            scope() === "Commands"
                                ? "What would you like to do?"
                                : scope() === "Site"
                                  ? "Find a page…"
                                  : scope() === "All"
                                    ? "Find events, people, news…"
                                    : `Search ${scope().toLowerCase()}…`
                        }
                        value={query()}
                        onInput={(event) => setQuery(event.currentTarget.value)}
                        onKeyDown={key}
                    />
                    <button class="search-close" aria-label="Close search" onClick={close}>
                        <kbd>Esc</kbd>
                    </button>
                </div>
                <div class="search-scopes">
                    <FilterPills
                        label="Search scope"
                        options={["All", ...searchKinds, "Commands", "Site"].map((value) => ({
                            value,
                            label: value,
                        }))}
                        value={scope()}
                        onChange={(value) => {
                            setScope(value as Scope);
                            input.focus();
                        }}
                    />
                </div>
                <Show when={catalogueScope() && catalogue.error()}>
                    <SearchNotice
                        message="Event and series search is temporarily unavailable."
                        retry={catalogue.retry}
                    />
                </Show>
                <Show when={serverScope() && results.error}>
                    <SearchNotice
                        message="Some search results could not load."
                        retry={() => void refetch()}
                    />
                </Show>
                <Show when={scope() === "All" && access.key() && drafts.error}>
                    <SearchNotice
                        message="Your draft events could not load."
                        retry={() => void retryDrafts()}
                    />
                </Show>
                <div class="search-results" role="listbox" id="palette-results">
                    <Show
                        when={
                            !matches().length &&
                            !(serverScope() && results.loading) &&
                            (!catalogueScope() || catalogue.isReady())
                        }
                    >
                        <div class="search-empty">
                            <SearchIcon />
                            <strong>
                                {query().trim()
                                    ? "No matches yet"
                                    : `Find ${scope().toLowerCase()} in the community`}
                            </strong>
                            <span>
                                {query().trim()
                                    ? "Try a name, topic, event number or organisation."
                                    : "Type a name or keyword to begin."}
                            </span>
                        </div>
                    </Show>
                    <For each={matches()}>
                        {(match, index) => (
                            <>
                                <Show
                                    when={
                                        index() === 0 ||
                                        matches()[index() - 1].command.group !== match.command.group
                                    }
                                >
                                    <div class="search-group" role="presentation">
                                        <span>
                                            {match.command.group === "Pages" &&
                                            !query().trim() &&
                                            scope() === "All"
                                                ? "Explore"
                                                : match.command.group}
                                        </span>
                                        <span class="search-group__count">
                                            {
                                                matches().filter(
                                                    (item) =>
                                                        item.command.group ===
                                                            match.command.group &&
                                                        !item.command.id.startsWith("all-"),
                                                ).length
                                            }
                                        </span>
                                    </div>
                                </Show>
                                <SearchResult
                                    match={match}
                                    index={index()}
                                    selected={selected()}
                                    onSelect={select}
                                    onChoose={(command) => void choose(command)}
                                />
                            </>
                        )}
                    </For>
                </div>
                <div class="search-footer">
                    <div class="search-status" role="status" aria-live="polite">
                        <Show when={error()}>{error()}</Show>

                        <Show when={(!serverScope() || !results.error) && !error()}>
                            {catalogueScope() && !catalogue.isReady() && !catalogue.error()
                                ? "Loading events and series…"
                                : serverScope() &&
                                    (results.loading || requested() !== query().trim())
                                  ? resultCount()
                                      ? "Searching other content…"
                                      : "Searching…"
                                  : matches().length
                                    ? `${resultCount()} result${resultCount() === 1 ? "" : "s"}`
                                    : "No results. Try another name or keyword."}
                        </Show>
                    </div>
                    <div class="search-keys" aria-hidden="true">
                        <span>
                            <kbd>↑</kbd>
                            <kbd>↓</kbd> Navigate
                        </span>
                        <span>
                            <kbd>↵</kbd> Open
                        </span>
                    </div>
                </div>
            </dialog>
        </>
    );
}
