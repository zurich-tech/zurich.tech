import { For, Show } from "solid-js";
import type { Command } from "./actions";
import type { HighlightPart } from "../../convex/search/ranking";

/** Render precomputed match segments as text, never injected HTML. */
function MatchedText(props: { parts: readonly HighlightPart[] }) {
    return (
        <For each={props.parts}>
            {(part) => (part.isMatch ? <mark class="search-match">{part.text}</mark> : part.text)}
        </For>
    );
}

/** Shared outline icons keep navigation and content rows visually consistent. */
export function SearchIcon(props: { group?: string }) {
    const paths: Record<string, string> = {
        Events: "M4 5h16v15H4z M8 3v4m8-4v4M4 10h16",
        Series: "M5 7h14v14H5z M8 3h8",
        People: "M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21v-2a8 8 0 0 1 16 0v2",
        Organisations: "M5 21V3h14v18M9 7h6m-6 4h6m-6 4h6",
        Jobs: "M3 7h18v14H3z M8 7V3h8v4M3 12h18",
        News: "M5 3h14v18H5z M8 7h8m-8 4h8m-8 4h5",
        "This page": "m13 2-9 12h7l-1 8 10-13h-8z",
        Create: "M12 4v16M4 12h16",
        Contribute: "M4 5h16v12H9l-5 4z M8 9h8m-8 4h5",
        Account: "M8 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M4 21v-2a8 8 0 0 1 16 0v2",
        Preferences: "M4 7h16M4 17h16M8 4v6m8 4v6",
        Admin: "M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M9 12l2 2 4-4",
        Pages: "M4 4h16v16H4z M4 9h16M9 9v11",
    };
    return (
        <svg
            class="search-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <Show
                when={props.group}
                fallback={
                    <>
                        <circle cx="10.5" cy="10.5" r="6.5" />
                        <path d="m16 16 5 5" />
                    </>
                }
            >
                <path d={paths[props.group!] ?? paths.Pages} />
            </Show>
        </svg>
    );
}

export type Match = {
    command: Command;
    labelParts: readonly HighlightPart[];
    descriptionParts: readonly HighlightPart[];
    startsAt?: number;
    detail?: string;
    image?: string;
};

/** Use the same Zurich clock for every event, regardless of the viewer's location. */
function eventDate(timestamp: number, options: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", ...options }).format(
        timestamp,
    );
}

/** One result layout for commands, records, dates and public portraits. */
export function SearchResult(props: {
    match: Match;
    index: number;
    selected: number;
    onSelect: (index: number) => void;
    onChoose: (command: Command) => void;
}) {
    return (
        <button
            type="button"
            role="option"
            tabIndex={-1}
            id={`palette-${props.index}`}
            aria-selected={props.index === props.selected}
            class="search-result"
            classList={{
                "search-result--collection": props.match.command.id.startsWith("all-"),
            }}
            onMouseMove={() => props.onSelect(props.index)}
            onClick={() => props.onChoose(props.match.command)}
        >
            <Show
                when={props.match.startsAt}
                fallback={
                    <Show
                        when={props.match.image}
                        fallback={
                            <SearchIcon
                                group={
                                    props.match.command.group === "Pages"
                                        ? props.match.command.label
                                        : props.match.command.group
                                }
                            />
                        }
                    >
                        <img class="search-avatar" src={props.match.image} alt="" loading="lazy" />
                    </Show>
                }
            >
                {(startsAt) => (
                    <span class="search-date" aria-hidden="true">
                        <strong>{eventDate(startsAt(), { day: "numeric" })}</strong>
                        <span>{eventDate(startsAt(), { month: "short" })}</span>
                    </span>
                )}
            </Show>
            <span class="search-result__text">
                <strong>
                    <MatchedText parts={props.match.labelParts} />
                </strong>
                <Show when={props.match.startsAt}>
                    {(startsAt) => (
                        <span class="search-result__detail">
                            {eventDate(startsAt(), {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            })}{" "}
                            · Zurich time
                        </span>
                    )}
                </Show>
                <Show when={props.match.detail}>
                    <span class="search-result__detail">{props.match.detail}</span>
                </Show>
                <Show when={props.match.descriptionParts.length}>
                    <span class="search-result__description">
                        <MatchedText parts={props.match.descriptionParts} />
                    </span>
                </Show>
            </span>
            <span class="search-result__enter" aria-hidden="true">
                ↵
            </span>
        </button>
    );
}
