/** Keep public HTML fresh for an hour, with five minutes for background regeneration. */
const freshSeconds = 3600;
const staleSeconds = 300;

/** Routes whose server rendering contains only published, anonymous information. */
const publicPaths = new Set([
    "/",
    "/about",
    "/events",
    "/news",
    "/jobs",
    "/series",
    "/members",
    "/organisations",
    "/map",
    "/photos",
    "/sponsor",
    "/contribute",
    "/legal",
    "/stats",
]);

/** Dependencies owned by the current Worker invocation. */
type PageCache = {
    version: string;
    storage: CacheStorage;
    waitUntil: (work: Promise<unknown>) => void;
    now?: () => number;
};

/** Admit only ordinary anonymous public-page requests, never actions or account links. */
export function isPublicPage(request: Request) {
    const url = new URL(request.url);
    const accept = request.headers.get("accept");
    if (
        request.method !== "GET" ||
        url.search ||
        request.headers.has("cookie") ||
        request.headers.has("authorization") ||
        request.headers.has("range") ||
        request.headers.has("upgrade") ||
        (accept && !accept.includes("text/html") && accept !== "*/*")
    )
        return false;

    // exclude editor paths even though they share public collection prefixes
    return (
        publicPaths.has(url.pathname) ||
        /^\/(events|news|jobs|series|members|organisations)\/(?!edit$|submit$)[a-z0-9][a-z0-9-]*$/.test(
            url.pathname,
        )
    );
}

/** Serve deployment-scoped public HTML without making cache writes delay the response. */
export async function cachedPage(
    request: Request,
    render: () => Promise<Response>,
    options: PageCache,
): Promise<Response> {
    if (!isPublicPage(request)) return render();
    const started = performance.now();

    // separate builds so cached documents cannot refer to a different deployment's modules
    const url = new URL(request.url);
    url.pathname = `/__pages/${encodeURIComponent(options.version)}${url.pathname}`;
    const now = options.now ?? Date.now;
    let cache: Cache | undefined;
    let saved: Response | undefined;
    try {
        cache = await options.storage.open("public-pages");
        saved = await cache.match(url.href);
    } catch (error) {
        console.error("Could not read public page cache.", error);
    }

    // serve stale HTML only within the explicit refresh window, never indefinitely on failure
    const age = saved ? (now() - Number(saved.headers.get("X-Page-Created"))) / 1000 : Infinity;
    if (saved && age >= 0 && age < freshSeconds + staleSeconds) {
        const isStale = age >= freshSeconds;
        if (isStale) {
            options.waitUntil(
                render()
                    .then((response) => storePage(cache, url.href, response, now()))
                    .catch((error) => console.error("Could not refresh public page.", error)),
            );
        }
        return pageResponse(saved, isStale ? "stale" : "hit", age, performance.now() - started);
    }

    // return the rendered result immediately and persist an independent copy in the background
    const response = await render();
    options.waitUntil(storePage(cache, url.href, response.clone(), now()));

    return pageResponse(response, "miss", 0, performance.now() - started);
}

/** Store only successful HTML without private headers or a rendered application error. */
async function storePage(
    cache: Cache | undefined,
    key: string,
    response: Response,
    created: number,
) {
    const control = response.headers.get("cache-control") ?? "";
    if (
        !cache ||
        response.status !== 200 ||
        response.headers.has("set-cookie") ||
        response.headers.has("vary") ||
        /private|no-store/i.test(control) ||
        !response.headers.get("content-type")?.includes("text/html")
    )
        return;

    try {
        const html = await response.text();
        if (/Could not load this page|Error \| Uncaught/.test(html)) return;
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", `public, max-age=${freshSeconds + staleSeconds}`);
        headers.set("X-Page-Created", String(created));
        headers.delete("Server-Timing");
        await cache.put(key, new Response(html, { headers }));
    } catch (error) {
        console.error("Could not store public page cache.", error);
    }
}

/** Keep browser revalidation while exposing the actual edge-cache outcome. */
function pageResponse(response: Response, status: string, age: number, duration: number) {
    const result = new Response(response.body, response);
    result.headers.delete("X-Page-Created");
    result.headers.set("X-Page-Cache", status);
    result.headers.set("X-Page-Age", String(Math.floor(age)));
    result.headers.append("Server-Timing", `page;desc="${status}";dur=${duration.toFixed(1)}`);

    // the long retention applies only inside the Worker, not to browsers or other shared caches
    if (status !== "miss") result.headers.set("Cache-Control", "no-cache");

    return result;
}
