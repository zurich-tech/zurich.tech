import { For } from "solid-js";

/** Show workspace tabs on desktop and the current section in a mobile selector. */
export function SectionTabs(props: {
    label: string;
    options: { id: string; label: string }[];
    value: string;
    onChange: (id: string) => void;
}) {
    return (
        <>
            <nav class="filter-bar admin-tabs" aria-label={props.label}>
                <For each={props.options}>
                    {(tab) => (
                        <button
                            type="button"
                            classList={{ active: props.value === tab.id }}
                            aria-pressed={props.value === tab.id}
                            onClick={() => props.onChange(tab.id)}
                        >
                            {tab.label}
                        </button>
                    )}
                </For>
            </nav>
            <label class="admin-section-picker field">
                <span class="field__label">Section</span>
                <select
                    class="field__control"
                    aria-label={props.label}
                    value={props.value}
                    onChange={(event) => props.onChange(event.currentTarget.value)}
                >
                    <For each={props.options}>
                        {(tab) => <option value={tab.id}>{tab.label}</option>}
                    </For>
                </select>
            </label>
        </>
    );
}
