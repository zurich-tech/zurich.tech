/** Redirect only published news aliases, retaining attribution query parameters. */
export async function newsRedirect(
    request: Request,
    canonical: (slug: string) => Promise<string | null>,
): Promise<Response | undefined> {
    if (request.method !== "GET" && request.method !== "HEAD") return;
    const url = new URL(request.url);
    const match = /^\/news\/(?:\d{4}\/\d{2}\/\d{2}\/)?([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(
        url.pathname,
    );
    if (!match || ["edit", "manage", "new"].includes(match[1])) return;

    // leave unknown and withdrawn stories to the ordinary not-found route
    const path = await canonical(match[1]);
    if (!path || path === url.pathname) return;

    return new Response(null, {
        status: 301,
        headers: { Location: path + url.search, "Cache-Control": "no-cache" },
    });
}
