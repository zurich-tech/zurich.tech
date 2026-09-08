/** Validate a public HTTP link. */
export function normalizeUrl(value: string): string {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:")
        throw new Error("Use an HTTP or HTTPS URL.");

    return url.href;
}
