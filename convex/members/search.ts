/** Join fields into the normalized text stored in a search index. */
export function searchText(...values: Array<string | undefined>): string {
    return values.filter((value) => value !== undefined && value !== "").join(" ");
}
