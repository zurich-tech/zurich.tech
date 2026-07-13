import type { JSX } from "solid-js";
import { Show, children } from "solid-js";

/** Table toolbar properties. */
type TableToolbarProps = {
    /** Commands placed after search. */
    actions?: JSX.Element;
    /** Receive search text. */
    onSearch?: (query: string) => void;
    /** Search placeholder. */
    placeholder?: string;
};

/** Search and commands attached to a table. */
export function TableToolbar(props: TableToolbarProps) {
    const actions = children(() => props.actions);

    return (
        <div class="table-toolbar">
            {/* search */}
            <Show when={props.onSearch !== undefined}>
                <label class="table-toolbar__search">
                    <span aria-hidden="true">/</span>
                    <span class="sr-only">search</span>
                    <input
                        autocomplete="off"
                        onInput={(event) => props.onSearch?.(event.currentTarget.value)}
                        placeholder={props.placeholder ?? "search..."}
                        type="search"
                    />
                </label>
            </Show>

            {/* commands */}
            <Show when={actions()}>
                <div class="table-toolbar__actions">{actions()}</div>
            </Show>
        </div>
    );
}
