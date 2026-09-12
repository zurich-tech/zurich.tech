import { For } from "solid-js";

/** Tags. */
export function Tags(props: { values: string[] }) {
    return (
        <div class="tags">
            {/* tags */}
            <For each={props.values}>{(value) => <span class="tag">{value}</span>}</For>
        </div>
    );
}
