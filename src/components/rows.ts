/** Filter and sort records without mutating their original order. */
export function gridRows<Row>(
    rows: readonly Row[],
    search: string,
    text: (row: Row) => string,
    value: (row: Row) => string | number,
    descending: boolean,
) {
    const query = search.trim().toLocaleLowerCase();
    const filtered = rows.filter((row) => text(row).toLocaleLowerCase().includes(query));

    return filtered.sort((left, right) => {
        const first = value(left);
        const second = value(right);
        const comparison =
            typeof first === "number" && typeof second === "number"
                ? first - second
                : String(first).localeCompare(String(second), "en", { numeric: true });
        return descending ? -comparison : comparison;
    });
}

/** Encode CSV cells while neutralising spreadsheet formula prefixes, including whitespace. */
export function csvText(rows: readonly (readonly string[])[]) {
    return rows
        .map((row) =>
            row
                .map(
                    (value) =>
                        `"${(/^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`,
                )
                .join(","),
        )
        .join("\r\n");
}
