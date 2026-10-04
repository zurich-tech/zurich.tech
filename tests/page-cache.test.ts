import { expect, test } from "bun:test";
import { cachedPage, isPublicPage } from "../src/server/pages";

/** Provide isolated cache storage and a controllable clock for complete request cycles. */
function fixture() {
    const saved = new Map<string, Response>();
    const work: Promise<unknown>[] = [];
    let time = 1000000;
    const options = {
        version: "build-one",
        now: () => time,
        waitUntil: (promise: Promise<unknown>) => work.push(promise),
        storage: {
            open: async () => ({
                match: async (key: string) => saved.get(key)?.clone(),
                put: async (key: string, response: Response) => {
                    saved.set(key, response);
                },
            }),
        } as unknown as CacheStorage,
    };

    return {
        options,
        saved,
        advance: (seconds: number) => {
            time += seconds * 1000;
        },
        settle: () => Promise.all(work.splice(0)),
    };
}

/** Render representative complete HTML. */
function documentResponse(
    body = "<html><main>Published page</main></html>",
    init: ResponseInit = {},
) {
    return new Response(body, {
        ...init,
        headers: { "Content-Type": "text/html", "Cache-Control": "no-cache", ...init.headers },
    });
}

test("test_exclude_private_routes_actions_credentials_and_request_variants", () => {
    for (const path of ["/", "/about", "/events/zurichnlp-22", "/jobs", "/news/story"]) {
        expect(isPublicPage(new Request(`https://zurich.tech${path}`))).toBe(true);
    }
    for (const path of [
        "/admin",
        "/settings",
        "/sign-in",
        "/registration",
        "/confirm",
        "/payment",
        "/unsubscribe",
        "/welcome",
        "/manage",
        "/submit",
        "/checkin",
        "/news/edit",
        "/jobs/submit",
        "/unknown",
        "/events/a?token=secret",
        "/?code=secret",
        "/?utm_source=email",
        "/_server",
        "/_build/app.js",
    ]) {
        expect(isPublicPage(new Request(`https://zurich.tech${path}`))).toBe(false);
    }
    const variants: Record<string, string>[] = [
        { cookie: "session=secret" },
        { authorization: "Bearer secret" },
        { accept: "application/json" },
        { range: "bytes=0-20" },
        { upgrade: "websocket" },
    ];
    for (const headers of variants) {
        expect(isPublicPage(new Request("https://zurich.tech/", { headers }))).toBe(false);
    }
    for (const method of ["POST", "HEAD", "PUT", "DELETE"]) {
        expect(isPublicPage(new Request("https://zurich.tech/", { method }))).toBe(false);
    }
});

test("test_reuse_complete_html_and_isolate_deployments_hosts_and_paths", async () => {
    const state = fixture();
    let renders = 0;
    const render = async () => documentResponse(`<html><main>${++renders}</main></html>`);
    const request = new Request("https://zurich.tech/");
    const first = await cachedPage(request, render, state.options);
    expect(first.headers.get("X-Page-Cache")).toBe("miss");
    expect(await first.text()).toBe("<html><main>1</main></html>");
    await state.settle();
    state.advance(3599);
    const second = await cachedPage(request, render, state.options);
    expect(await second.text()).toBe("<html><main>1</main></html>");
    expect(second.headers.get("X-Page-Cache")).toBe("hit");
    expect(second.headers.get("X-Page-Age")).toBe("3599");
    expect(second.headers.get("Cache-Control")).toBe("no-cache");
    expect(second.headers.has("X-Page-Created")).toBe(false);
    expect(renders).toBe(1);
    // a populated public cache must never replace an authenticated response
    const credentials: Record<string, string>[] = [
        { Cookie: "session=private" },
        { Authorization: "Bearer private" },
    ];
    for (const headers of credentials) {
        const privateResponse = await cachedPage(
            new Request(request, { headers }),
            async () => documentResponse("account-specific"),
            state.options,
        );
        expect(await privateResponse.text()).toBe("account-specific");
        expect(privateResponse.headers.has("X-Page-Cache")).toBe(false);
    }
    expect(await (await cachedPage(request, render, state.options)).text()).toBe(
        "<html><main>1</main></html>",
    );
    for (const [url, version] of [
        [request.url, "build-two"],
        ["https://zurich.tech/about", "build-one"],
        ["https://other.example/", "build-one"],
    ]) {
        const result = await cachedPage(new Request(url), render, { ...state.options, version });
        expect(result.headers.get("X-Page-Cache")).toBe("miss");
        await result.text();
    }
    await state.settle();
    expect(renders).toBe(4);
    expect(state.saved.size).toBe(4);
});

test("test_return_html_when_background_storage_fails", async () => {
    const state = fixture();
    const previousError = console.error;
    const errors: string[] = [];
    console.error = (message) => errors.push(message);
    try {
        const options = {
            ...state.options,
            storage: {
                open: async () => ({
                    match: async () => undefined,
                    put: async () => {
                        throw new Error("Write failed");
                    },
                }),
            } as unknown as CacheStorage,
        };
        const response = await cachedPage(
            new Request("https://zurich.tech/"),
            async () => documentResponse("current"),
            options,
        );
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("current");
        await state.settle();
        expect(errors).toEqual(["Could not store public page cache."]);
        expect(state.saved.size).toBe(0);
    } finally {
        console.error = previousError;
    }
});

test("test_refresh_stale_html_without_blocking_then_enforce_expiration", async () => {
    const state = fixture();
    const request = new Request("https://zurich.tech/events");
    await cachedPage(request, async () => documentResponse("old"), state.options);
    await state.settle();
    state.advance(3600);
    let finish!: (response: Response) => void;
    const render = () =>
        new Promise<Response>((resolve) => {
            finish = resolve;
        });
    const stale = await cachedPage(request, render, state.options);
    expect(stale.headers.get("X-Page-Cache")).toBe("stale");
    expect(await stale.text()).toBe("old");
    finish(documentResponse("new"));
    await state.settle();
    const fresh = await cachedPage(request, render, state.options);
    expect(await fresh.text()).toBe("new");
    expect(fresh.headers.get("X-Page-Cache")).toBe("hit");
    state.advance(3900);
    const expired = await cachedPage(
        request,
        async () => documentResponse("current"),
        state.options,
    );
    expect(await expired.text()).toBe("current");
    expect(expired.headers.get("X-Page-Cache")).toBe("miss");
    await state.settle();
});

test("test_never_cache_errors_redirects_personalized_responses_or_private_requests", async () => {
    const state = fixture();
    const request = new Request("https://zurich.tech/");
    const cases = [
        documentResponse("failure", { status: 500 }),
        documentResponse("missing", { status: 404 }),
        documentResponse("redirect", { status: 302, headers: { Location: "/sign-in" } }),
        documentResponse("private", { headers: { "Cache-Control": "private" } }),
        documentResponse("private", { headers: { "Cache-Control": "no-store" } }),
        documentResponse("session", { headers: { "Set-Cookie": "session=secret" } }),
        documentResponse("varies", { headers: { Vary: "Cookie" } }),
        documentResponse("<main>Could not load this page</main>"),
        new Response('{"secret":true}', { headers: { "Content-Type": "application/json" } }),
    ];
    for (const response of cases) {
        const result = await cachedPage(request, async () => response, state.options);
        expect(result.status).toBe(response.status);
        await result.text();
        await state.settle();
        expect(state.saved.size).toBe(0);
    }
    const privateResult = await cachedPage(
        new Request(request, { headers: { cookie: "session=secret" } }),
        async () => documentResponse("private"),
        state.options,
    );
    expect(await privateResult.text()).toBe("private");
    expect(privateResult.headers.has("X-Page-Cache")).toBe(false);
    expect(state.saved.size).toBe(0);
    await expect(
        cachedPage(
            request,
            async () => {
                throw new Error("Backend unavailable");
            },
            state.options,
        ),
    ).rejects.toThrow("Backend unavailable");
});

test("test_keep_cache_failures_off_the_response_path_and_bound_failed_refreshes", async () => {
    const state = fixture();
    const request = new Request("https://zurich.tech/");
    const previousError = console.error;
    const errors: string[] = [];
    console.error = (message) => errors.push(message);
    try {
        const unavailable = {
            ...state.options,
            storage: {
                open: async () => {
                    throw new Error("Cache unavailable");
                },
            } as unknown as CacheStorage,
        };
        const uncached = await cachedPage(
            request,
            async () => documentResponse("live"),
            unavailable,
        );
        expect(await uncached.text()).toBe("live");
        await state.settle();

        await cachedPage(request, async () => documentResponse("saved"), state.options);
        await state.settle();
        state.advance(3600);
        const fail = async (): Promise<Response> => {
            throw new Error("Backend unavailable");
        };
        const stale = await cachedPage(request, fail, state.options);
        expect(await stale.text()).toBe("saved");
        await state.settle();
        state.advance(300);
        await expect(cachedPage(request, fail, state.options)).rejects.toThrow(
            "Backend unavailable",
        );
        expect(errors).toEqual([
            "Could not read public page cache.",
            "Could not refresh public page.",
        ]);
    } finally {
        console.error = previousError;
    }
});
