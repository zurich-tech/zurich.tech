import { For } from "solid-js";

import { highlightParts } from "../search/search";

/** Highlight properties. */
type HighlightProps = {
    /** The terms to highlight. */
    terms: readonly string[];
    /** The visible text. */
    text: string;
};

/** Render case-preserving search highlights. */
export function Highlight(props: HighlightProps) {
    return (
        <For each={highlightParts(props.text, props.terms)}>
            {(part) => (part.isMatch ? <mark>{part.text}</mark> : part.text)}
        </For>
    );
}
