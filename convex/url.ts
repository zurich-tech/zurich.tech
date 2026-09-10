/** Validate a public HTTP link. */
export function normalizeUrl(value: string): string {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:")
        throw new Error("Use an HTTP or HTTPS URL.");

    return url.href;
}

/** Validate an external image URL or an image hosted by this site. */
export function normalizeImageUrl(value: string): string {
    if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;

    return normalizeUrl(value);
}
