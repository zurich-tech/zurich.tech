import { assetReferences, validateAsset } from "../deployment/assets";

/** Check completed public HTML against a built preview or deployment. */
async function main() {
    const origin = process.argv[2];
    if (!origin) throw new Error("Usage: bun scripts/rendering/check.ts <origin>");
    const paths = process.argv.slice(3);
    const routes = paths.length
        ? paths
        : ["/", "/events", "/news", "/series", "/about", "/jobs", "/sponsor", "/map"];

    const assets = new Set<string>();

    // Test HTML before JavaScript can conceal a server rendering failure.
    for (const path of routes) {
        const started = performance.now();
        const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
        const headers = performance.now();
        const html = await response.text();
        for (const name of assetReferences(html)) assets.add(name);
        if (!response.headers.get("cache-control")?.includes("no-cache"))
            throw new Error(`${path}: HTML must revalidate`);
        const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];
        if (response.status !== 200) throw new Error(`${path}: HTTP ${response.status}`);
        if (!main?.trim()) throw new Error(`${path}: missing server-rendered main content`);
        if (/<template\s+id="(?:pl-)?\d/.test(html))
            throw new Error(`${path}: unresolved server fragment`);
        if (/Error \| Uncaught|Could not load this page/.test(main))
            throw new Error(`${path}: rendered an error`);
        console.log(
            JSON.stringify({
                path,
                headersMs: Math.round(headers - started),
                totalMs: Math.round(performance.now() - started),
                htmlBytes: new TextEncoder().encode(html).length,
            }),
        );
    }

    // verify the deployed entrypoint actually bypasses rendering on repeated public visits
    const cacheUrl = new URL("/about", origin);
    let hit = false;
    for (let attempt = 0; attempt < 5; attempt++) {
        const response = await fetch(cacheUrl, { signal: AbortSignal.timeout(15000) });
        await response.text();
        if (response.headers.get("X-Page-Cache") === "hit") {
            hit = true;
            break;
        }
        await Bun.sleep(200);
    }
    if (!hit) throw new Error("Public HTML did not enter the page cache");
    for (const request of [
        new Request(cacheUrl, { headers: { Cookie: "cache-check=1" } }),
        new Request(new URL("/about?cache-check=1", origin)),
    ]) {
        const response = await fetch(request, { signal: AbortSignal.timeout(15000) });
        await response.text();
        if (response.headers.has("X-Page-Cache"))
            throw new Error("Private or parameterized requests must bypass the page cache");
    }

    // Exercise lazy routes and their imports, not just the initial document.
    for (const name of assets) {
        const response = await fetch(new URL(`/_build/assets/${name}`, origin), {
            signal: AbortSignal.timeout(15000),
        });
        validateAsset(response, name);
        if (/\.(js|css)$/.test(name)) {
            for (const dependency of assetReferences(await response.text())) assets.add(dependency);
        } else await response.arrayBuffer();
    }
    const missing = await fetch(new URL("/_build/assets/missing-deployment-check.js", origin));
    if (missing.status !== 404 || missing.headers.get("cache-control") !== "no-store")
        throw new Error("Missing assets must return an uncached 404");
    console.log(`Verified ${assets.size} build assets and uncached missing-file handling.`);
}

await main();
