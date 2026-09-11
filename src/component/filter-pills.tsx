import { For } from "solid-js";

/** Choose one value using the shared compact filter buttons. */
export function FilterPills(props: {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div class="filter-pills" role="group" aria-label={props.label}>
            <For each={props.options}>
                {(option) => (
                    <button
                        type="button"
                        aria-pressed={props.value === option.value}
                        classList={{ selected: props.value === option.value }}
                        onClick={() => props.onChange(option.value)}
                    >
                        {option.label}
                    </button>
                )}
            </For>
        </div>
    );
}
