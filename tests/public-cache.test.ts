import { expect, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import { RequestContext } from "solid-js/web";
import { cachedPublic } from "../src/data/cache";

/** Return current content before a background cache write finishes. */
test("public cache does not wait for storage when the request owns background work", async () => {
    const globals = globalThis as typeof globalThis & { [RequestContext]?: unknown };
    const previousContext = globals[RequestContext];
    const previousCaches = globals.caches;
    const context = new AsyncLocalStorage();
    const background: Promise<unknown>[] = [];
    const write = Promise.withResolvers<void>();
    globals[RequestContext] = context;
    globals.caches = {
        open: async () => ({ match: async () => undefined, put: () => write.promise }),
    } as unknown as CacheStorage;

    try {
        const result = context.run(
            {
                request: new Request("https://example.com/news"),
                response: { headers: new Headers() },
                nativeEvent: {
                    context: { waitUntil: (work: Promise<unknown>) => background.push(work) },
                },
            },
            () => cachedPublic("background", async () => "Current"),
        );
        expect(await Promise.race([result, Bun.sleep(1000).then(() => "Blocked")])).toBe("Current");
        expect(background.length).toBe(1);
    } finally {
        write.resolve();
        await Promise.all(background);
        globals[RequestContext] = previousContext;
        globals.caches = previousCaches;
    }
});

/** Check caching without replacing Solid's request isolation or Convex's value encoding. */
test("public cache reuses values, isolates keys, sets bounded freshness and never stores failures", async () => {
    const globals = globalThis as typeof globalThis & { [RequestContext]?: unknown };
    const previousContext = globals[RequestContext];
    const previousCaches = globals.caches;
    const context = new AsyncLocalStorage();
    const saved = new Map<string, { body: string; headers: Headers }>();
    globals[RequestContext] = context;
    globals.caches = {
        open: async () => ({
            match: async (key: string) => {
                const entry = saved.get(key);
                return entry ? new Response(entry.body, { headers: entry.headers }) : undefined;
            },
            put: async (key: string, response: Response) => {
                saved.set(key, { body: await response.text(), headers: response.headers });
            },
        }),
    } as unknown as CacheStorage;
    const event = {
        request: new Request("https://example.com/news"),
        response: { headers: new Headers() },
    };

    try {
        await context.run(event, async () => {
            let reads = 0;
            const read = async () => ({ count: ++reads, amount: 12n, rows: ["public"] });
            for (const [key, count] of [
                ["deployment-a:query:{}", 1],
                ["deployment-a:query:{}", 1],
                ["deployment-b:query:{}", 2],
                ["deployment-a:query:{slug:other}", 3],
            ] as const) {
                expect(await cachedPublic(key, read)).toEqual({
                    count,
                    amount: 12n,
                    rows: ["public"],
                });
            }
            expect(saved.size).toBe(3);
            expect([...saved.values()].map((value) => value.headers.get("cache-control"))).toEqual([
                "public, max-age=30",
                "public, max-age=30",
                "public, max-age=30",
            ]);

            let failures = 0;
            const fail = async () => {
                failures++;
                throw new Error("Backend unavailable");
            };
            await expect(cachedPublic("failure", fail)).rejects.toThrow("Backend unavailable");
            await expect(cachedPublic("failure", fail)).rejects.toThrow("Backend unavailable");
            expect(failures).toBe(2);
            expect(saved.size).toBe(3);
            expect(event.response.headers.get("server-timing")).toContain('desc="hit"');
        });

        // Outside a server request, no shared cache is read or written.
        let reads = 0;
        expect(await cachedPublic("deployment-a:query:{}", async () => ++reads)).toBe(1);
        expect(await cachedPublic("deployment-a:query:{}", async () => ++reads)).toBe(2);
        expect(saved.size).toBe(3);
    } finally {
        globals[RequestContext] = previousContext;
        globals.caches = previousCaches;
    }
});

/** Cache infrastructure must not turn a successful backend response into a broken page. */
test("public reads survive cache storage failures", async () => {
    const globals = globalThis as typeof globalThis & { [RequestContext]?: unknown };
    const previousContext = globals[RequestContext];
    const previousCaches = globals.caches;
    const previousError = console.error;
    const context = new AsyncLocalStorage();
    globals[RequestContext] = context;
    const messages: string[] = [];
    console.error = (message) => messages.push(message);
    try {
        for (const operation of ["open", "match", "put"]) {
            globals.caches = {
                open: async () => {
                    if (operation === "open") throw new Error("Storage unavailable");
                    return {
                        match: async () => {
                            if (operation === "match") throw new Error("Read failed");
                            return undefined;
                        },
                        put: async () => {
                            if (operation === "put") throw new Error("Write failed");
                        },
                    };
                },
            } as unknown as CacheStorage;
            await context.run(
                {
                    request: new Request("https://example.com/news"),
                    response: { headers: new Headers() },
                },
                async () => {
                    expect(
                        await cachedPublic(operation, async () => ({ title: "Current" })),
                    ).toEqual({ title: "Current" });
                },
            );
        }
        expect(messages).toEqual([
            "Could not read public cache; requesting current data.",
            "Could not read public cache; requesting current data.",
            "Could not store public cache; returning current data.",
        ]);
    } finally {
        globals[RequestContext] = previousContext;
        globals.caches = previousCaches;
        console.error = previousError;
    }
});
