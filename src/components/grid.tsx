import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download } from "lucide-solid";
import { createEffect, createMemo, createSignal, For, Show, type JSX } from "solid-js";
import { TableToolbar } from "./toolbar";
import { FilterSelect } from "./filter-select";
import { gridRows, csvText } from "./rows";
import "./grid.css";

/** One sortable and exportable grid column. */
export type GridColumn<Row> = {
    /** Stable column identity. */
    id: string;
    /** Visible heading and CSV heading. */
    label: string;
    /** Sort and export value. */
    value: (row: Row) => string | number;
    /** Optional cell presentation. */
    render?: (row: Row) => JSX.Element;
    /** Disable sorting for command columns. */
    isSortable?: boolean;
    /** Format exported values or omit command columns. */
    exportValue?: ((row: Row) => string) | false;
};

/** Search, sort, page and export a bounded administrative record set. */
export function DataGrid<Row>(props: {
    rows: readonly Row[];
    columns: GridColumn<Row>[];
    label: string;
    filename: string;
    initialSort: string;
    filters?: JSX.Element;
    searchText?: (row: Row) => string;
    row?: (row: Row) => JSX.Element;
}) {
    const [search, setSearch] = createSignal("");
    const [sort, setSort] = createSignal({ id: props.initialSort, descending: true });
    const [page, setPage] = createSignal(0);
    const [size, setSize] = createSignal(25);
    // start at the first page when the parent changes the filtered record set
    createEffect(() => {
        props.rows;
        setPage(0);
    });
    const rows = createMemo(() => {
        const column =
            props.columns.find((column) => column.id === sort().id) ??
            props.columns.find((column) => column.id === props.initialSort)!;
        return gridRows(
            props.rows,
            search(),
            props.searchText ?? ((row) => props.columns.map((item) => item.value(row)).join(" ")),
            column.value,
            sort().descending,
        );
    });
    const pages = () => Math.max(1, Math.ceil(rows().length / size()));
    const current = () => Math.min(page(), pages() - 1);
    const visible = () => rows().slice(current() * size(), (current() + 1) * size());

    /** Export every matching row in its displayed sort order. */
    function download() {
        const columns = props.columns.filter((column) => column.exportValue !== false);
        const csv = csvText([
            columns.map((column) => column.label),
            ...rows().map((row) =>
                columns.map((column) =>
                    typeof column.exportValue === "function"
                        ? column.exportValue(row)
                        : String(column.value(row)),
                ),
            ),
        ]);
        const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = props.filename;
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div class="data-grid">
            <TableToolbar
                placeholder={`Search ${props.label.toLowerCase()}…`}
                value={search()}
                onSearch={(value) => {
                    setSearch(value);
                    setPage(0);
                }}
            >
                {props.filters}
                <button class="button" disabled={!rows().length} onClick={download}>
                    <Download size={16} /> Export CSV
                </button>
            </TableToolbar>
            <div class="table-scroll" role="region" aria-label={props.label} tabIndex={0}>
                <table class="admin-table">
                    <caption class="sr-only">{props.label}</caption>
                    <thead>
                        <tr>
                            <For each={props.columns}>
                                {(column) => (
                                    <th
                                        scope="col"
                                        aria-sort={
                                            sort().id === column.id
                                                ? sort().descending
                                                    ? "descending"
                                                    : "ascending"
                                                : "none"
                                        }
                                    >
                                        <Show
                                            when={column.isSortable !== false}
                                            fallback={column.label}
                                        >
                                            <button
                                                class="grid-sort"
                                                onClick={() => {
                                                    setSort({
                                                        id: column.id,
                                                        descending:
                                                            sort().id === column.id
                                                                ? !sort().descending
                                                                : false,
                                                    });
                                                    setPage(0);
                                                }}
                                            >
                                                {column.label}
                                                <Show
                                                    when={sort().id === column.id}
                                                    fallback={<ArrowUpDown size={13} />}
                                                >
                                                    <Show
                                                        when={sort().descending}
                                                        fallback={<ArrowUp size={13} />}
                                                    >
                                                        <ArrowDown size={13} />
                                                    </Show>
                                                </Show>
                                            </button>
                                        </Show>
                                    </th>
                                )}
                            </For>
                        </tr>
                    </thead>
                    <tbody>
                        <For
                            each={visible()}
                            fallback={
                                <tr>
                                    <td colSpan={props.columns.length}>
                                        No matching {props.label.toLowerCase()}.
                                    </td>
                                </tr>
                            }
                        >
                            {(row) =>
                                props.row ? (
                                    props.row(row)
                                ) : (
                                    <tr>
                                        <For each={props.columns}>
                                            {(column) => (
                                                <td>
                                                    {column.render
                                                        ? column.render(row)
                                                        : column.value(row)}
                                                </td>
                                            )}
                                        </For>
                                    </tr>
                                )
                            }
                        </For>
                    </tbody>
                </table>
            </div>
            <div class="grid-footer">
                <span role="status">
                    {rows().length ? current() * size() + 1 : 0}–
                    {Math.min((current() + 1) * size(), rows().length)} of {rows().length}
                </span>
                <FilterSelect
                    label="Rows per page"
                    value={String(size())}
                    options={[25, 50, 100].map((value) => ({
                        value: String(value),
                        label: `${value} per page`,
                    }))}
                    onChange={(value) => {
                        setSize(Number(value));
                        setPage(0);
                    }}
                />
                <button
                    class="icon-button"
                    title="Previous page"
                    aria-label="Previous page"
                    disabled={current() === 0}
                    onClick={() => setPage(current() - 1)}
                >
                    <ChevronLeft size={18} />
                </button>
                <button
                    class="icon-button"
                    title="Next page"
                    aria-label="Next page"
                    disabled={current() + 1 >= pages()}
                    onClick={() => setPage(current() + 1)}
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}
