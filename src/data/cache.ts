import { getRequestEvent } from "solid-js/web";
import { convexToJson, jsonToConvex, type Value } from "convex/values";

/** Bound the age of public snapshots used for initial HTML. */
const maxAge = 30;

/** Reuse only anonymous query results, separately for each build and backend deployment. */
export async function cachedPublic<T extends Value>(
    key: string,
    read: () => Promise<T>,
): Promise<T> {
    const started = performance.now();
    const event = getRequestEvent();
    if (!event || typeof caches === "undefined") return read();

    // Keep the cache private to the Worker, outside browser and HTML response caching.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    const hash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");
    const url = new URL(
        `/__public/${import.meta.env.VITE_PUBLIC_BUILD}/${hash}`,
        event.request.url,
    );
    let cache: Cache | undefined;
    try {
        cache = await caches.open("public-queries");
        const saved = await cache.match(url.href);
        if (saved) {
            const value = jsonToConvex(await saved.json()) as T;
            event.response.headers.append(
                "Server-Timing",
                `public;desc="hit";dur=${(performance.now() - started).toFixed(1)}`,
            );
            return value;
        }
    } catch (error) {
        console.error("Could not read public cache; requesting current data.", error);
    }

    // Cache successful values only; query failures remain visible and are never persisted.
    const value = await read();
    const response = new Response(JSON.stringify(convexToJson(value)), {
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${maxAge}`,
        },
    });
    try {
        await cache?.put(url.href, response);
    } catch (error) {
        console.error("Could not store public cache; returning current data.", error);
    }
    event.response.headers.append(
        "Server-Timing",
        `public;desc="miss";dur=${(performance.now() - started).toFixed(1)}`,
    );

    return value;
}
