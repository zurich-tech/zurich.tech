/** Read only the campaign labels and public path from the initial page URL. */
export function arrival(url: URL) {
    // private routes and query parameters must never enter campaign analytics
    const path = url.pathname;
    if (!/^\/(?:events(?:\/[a-z0-9-]+)?|news(?:\/[a-z0-9-]+)?|about|map|jobs|sponsor)?$/.test(path))
        return null;

    // require exactly one bounded value for each standard campaign dimension
    const labels = ["utm_source", "utm_medium", "utm_campaign"].map((key) =>
        url.searchParams.getAll(key),
    );
    if (
        labels.some(
            (values) => values.length !== 1 || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(values[0]),
        )
    )
        return null;
    const [source, medium, campaign] = labels.map((values) => values[0]);

    return { path, source, medium, campaign };
}
