import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { retainAssets, archiveLiveAssets, validateAsset } from "../scripts/deployment/assets";

test("deployment keeps old lazy imports, expires old builds and rejects changed immutable files", async () => {
    const root = await mkdtemp(join(tmpdir(), "zt-assets-"));
    const archive = join(root, "archive");
    const day = 86400000;
    try {
        // A tab opened on the first build can still load its route after the second deploy.
        const first = join(root, "first");
        const second = join(root, "second");
        await mkdir(first);
        await mkdir(second);
        await Bun.write(join(first, "route-old.js"), 'import "./shared.js"');
        await Bun.write(join(first, "shared.js"), "shared");
        await retainAssets(first, archive, day);
        await Bun.write(join(second, "route-new.js"), 'import "./shared.js"');
        await Bun.write(join(second, "shared.js"), "shared");
        await retainAssets(second, archive, 20 * day);
        expect((await readdir(second)).sort()).toEqual([
            "route-new.js",
            "route-old.js",
            "shared.js",
        ]);
        expect(await Bun.file(join(second, "route-old.js")).text()).toBe('import "./shared.js"');

        // Retention starts at replacement: a build still live after a long gap stays usable.
        const third = join(root, "third");
        await mkdir(third);
        await Bun.write(join(third, "route-latest.js"), "latest");
        await retainAssets(third, archive, 52 * day);
        expect((await readdir(third)).sort()).toEqual([
            "route-latest.js",
            "route-new.js",
            "shared.js",
        ]);
        await Bun.write(join(third, "shared.js"), "changed under the same URL");
        await expect(retainAssets(third, archive, 53 * day)).rejects.toThrow(
            "Asset changed without changing its URL: shared.js",
        );
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("first deployment archives the live module graph including lazy routes, styles and fonts", async () => {
    const root = await mkdtemp(join(tmpdir(), "zt-assets-"));
    const files: Record<string, string> = {
        "/": '<script src="/_build/assets/entry-abcd.js"></script>',
        "/_build/assets/entry-abcd.js": 'import("./event-abcd.js"); import "./style-abcd.css";',
        "/_build/assets/event-abcd.js": 'import "./entry-abcd.js";',
        "/_build/assets/style-abcd.css": "src:url(./font-abcd.woff2)",
        "/_build/assets/font-abcd.woff2": "font",
    };
    const server = Bun.serve({
        port: 0,
        fetch(request) {
            const body = files[new URL(request.url).pathname];
            const path = new URL(request.url).pathname;
            return new Response(body, {
                status: body === undefined ? 404 : 200,
                headers: {
                    "Content-Type": path.endsWith(".js")
                        ? "text/javascript"
                        : path.endsWith(".css")
                          ? "text/css"
                          : "text/plain",
                },
            });
        },
    });
    try {
        await archiveLiveAssets(server.url.href, root);
        expect((await readdir(root)).sort()).toEqual([
            "entry-abcd.js",
            "event-abcd.js",
            "font-abcd.woff2",
            "manifest.json",
            "style-abcd.css",
        ]);
        delete files["/_build/assets/event-abcd.js"];
        await expect(archiveLiveAssets(server.url.href, root)).rejects.toThrow(
            "Cannot retain event-abcd.js: 404",
        );
    } finally {
        server.stop(true);
        await rm(root, { recursive: true, force: true });
    }
});

test("asset verification rejects successful HTML fallbacks and accepts JavaScript MIME variants", () => {
    expect(() =>
        validateAsset(
            new Response("<html>fallback</html>", { headers: { "Content-Type": "text/html" } }),
            "event.js",
        ),
    ).toThrow("Invalid asset event.js: HTTP 200, text/html");
    for (const type of ["text/javascript", "application/javascript; charset=utf-8"]) {
        expect(() =>
            validateAsset(
                new Response("export default {}", { headers: { "Content-Type": type } }),
                "event.js",
            ),
        ).not.toThrow();
    }
    expect(() => validateAsset(new Response("", { status: 404 }), "site.css")).toThrow("HTTP 404");
});
