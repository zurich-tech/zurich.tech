import { expect, test } from "bun:test";
import { createMemo, createRenderEffect, createRoot, createSignal, onCleanup } from "solid-js";
import { isServer } from "solid-js/web";
import { createCommands } from "../src/search/actions";
import { routeParam } from "../src/app/params";

/** Exercise browser reactivity rather than Solid's static server implementation. */
test("page commands update within their route and disappear before its parameters are removed", () => {
    if (isServer) {
        const result = Bun.spawnSync([
            process.execPath,
            "--conditions=browser",
            "test",
            import.meta.path,
        ]);
        expect(result.stderr.toString()).not.toContain("Missing route parameter");
        expect(result.exitCode).toBe(0);
        return;
    }

    const app = createRoot((dispose) => {
        const registry = createCommands();
        const [slug, setSlug] = createSignal<string | undefined>();
        const items = createMemo(() => registry.items());
        const isEvent = createMemo(() => slug() !== undefined);

        // Model the router disposing an outgoing page when its route no longer matches.
        createRenderEffect(() => {
            if (!isEvent()) return;
            const disposePage = createRoot((disposePage) => {
                onCleanup(
                    registry.register(() => [
                        {
                            id: "event",
                            label: routeParam("slug", slug()),
                            group: "This event",
                            href: `/events/${slug()}`,
                        },
                    ]),
                );
                return disposePage;
            });
            onCleanup(disposePage);
        });

        return { dispose, items, setSlug };
    });
    try {
        app.setSlug("first");
        expect(app.items().map((item) => item.label)).toEqual(["first"]);
        app.setSlug("second");
        expect(app.items().map((item) => item.label)).toEqual(["second"]);
        app.setSlug(undefined);
        expect(app.items()).toEqual([]);
        app.setSlug("first");
        expect(app.items().map((item) => item.label)).toEqual(["first"]);
    } finally {
        app.dispose();
    }
});
