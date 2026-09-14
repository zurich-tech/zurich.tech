import type { JSX } from "solid-js";
import "./toolbar.css";
/** Table toolbar properties. */
type TableToolbarProps = {
    /** Receive search text. */
    onSearch: (query: string) => void;
    /** Search placeholder. */
    placeholder?: string;
    value?: string;
    children?: JSX.Element;
};

/** Search attached to a table. */
export function TableToolbar(props: TableToolbarProps) {
    return (
        <div class="table-toolbar catalogue-toolbar">
            {props.children}
            {/* search */}
            <label class="table-toolbar__search">
                <span class="sr-only">{props.placeholder ?? "Search"}</span>
                <input
                    class="field__control"
                    value={props.value}
                    autocomplete="off"
                    onInput={(event) => props.onSearch(event.currentTarget.value)}
                    placeholder={props.placeholder ?? "Search…"}
                    type="search"
                />
            </label>
        </div>
    );
}
