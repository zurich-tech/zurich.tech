/** Table toolbar properties. */
type TableToolbarProps = {
    /** Receive search text. */
    onSearch: (query: string) => void;
    /** Search placeholder. */
    placeholder?: string;
};

/** Search attached to a table. */
export function TableToolbar(props: TableToolbarProps) {
    return (
        <div class="table-toolbar">
            {/* search */}
            <label class="table-toolbar__search">
                <span aria-hidden="true">/</span>
                <span class="sr-only">search</span>
                <input
                    autocomplete="off"
                    onInput={(event) => props.onSearch(event.currentTarget.value)}
                    placeholder={props.placeholder ?? "search..."}
                    type="search"
                />
            </label>
        </div>
    );
}
