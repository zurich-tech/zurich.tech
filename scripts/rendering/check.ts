/** Check completed public HTML against a built preview or deployment. */
async function main() {
    const origin = process.argv[2];
    if (!origin) throw new Error("Usage: bun scripts/rendering/check.ts <origin>");
    const paths = process.argv.slice(3);
    const routes = paths.length
        ? paths
        : ["/", "/events", "/news", "/series", "/about", "/jobs", "/sponsor", "/map"];

    // Test HTML before JavaScript can conceal a server rendering failure.
    for (const path of routes) {
        const started = performance.now();
        const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(15000) });
        const headers = performance.now();
        const html = await response.text();
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
}

await main();
