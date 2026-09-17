import { mkdir, readdir, readFile, copyFile, rm } from "node:fs/promises";
import { join } from "node:path";

const retention = 30 * 24 * 60 * 60 * 1000;
const assetName = /^[\w.-]+\.[\w]+$/;

/** Keep each build's immutable files available to tabs opened before deployment. */
export async function retainAssets(current: string, archive: string, now = Date.now()) {
    await mkdir(archive, { recursive: true });
    const manifest = join(archive, "manifest.json");
    const previous: { current: string[]; files: Record<string, number> } = (await Bun.file(
        manifest,
    ).exists())
        ? await Bun.file(manifest).json()
        : { current: [], files: {} };
    const dates = previous.files;
    const fresh = await readdir(current);
    const freshNames = new Set(fresh);

    // The replaced build was live until now, even after months without a deployment.
    for (const name of previous.current) dates[name] = now;

    // Never overwrite a content-addressed URL with different bytes.
    for (const name of fresh) {
        if (!assetName.test(name)) throw new Error(`Unexpected asset: ${name}`);
        const source = join(current, name);
        const destination = join(archive, name);
        if (await Bun.file(destination).exists()) {
            if (!(await readFile(source)).equals(await readFile(destination)))
                throw new Error(`Asset changed without changing its URL: ${name}`);
        } else await copyFile(source, destination);
        dates[name] = now;
    }

    // Expire old builds without allowing shared files to expire while still in use.
    for (const [name, lastSeen] of Object.entries(dates)) {
        if (!assetName.test(name) || !Number.isFinite(lastSeen))
            throw new Error("Invalid asset archive manifest.");
        if (lastSeen < now - retention) {
            await rm(join(archive, name), { force: true });
            delete dates[name];
        } else if (!freshNames.has(name)) await copyFile(join(archive, name), join(current, name));
    }
    await Bun.write(manifest, JSON.stringify({ current: fresh, files: dates }));
}

/** Bootstrap retention from the live site's public module graph on the first deployment. */
export async function archiveLiveAssets(origin: string, archive: string) {
    await mkdir(archive, { recursive: true });
    const dates: Record<string, number> = {};
    const pending = new Set<string>();
    const discover = (text: string) => {
        for (const name of assetReferences(text)) pending.add(name);
    };
    const page = await fetch(origin, { signal: AbortSignal.timeout(15000) });
    if (!page.ok) throw new Error(`Cannot read deployed site: ${page.status}`);
    discover(await page.text());
    if (!pending.size) throw new Error("The deployed site contains no asset references.");

    // Follow lazy route imports as well as their shared modules and styles.
    for (const name of pending) {
        const response = await fetch(new URL(`/_build/assets/${name}`, origin), {
            signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`Cannot retain ${name}: ${response.status}`);
        validateAsset(response, name);
        const bytes = new Uint8Array(await response.arrayBuffer());
        await Bun.write(join(archive, name), bytes);
        dates[name] = Date.now();
        if (/\.(js|css)$/.test(name)) discover(new TextDecoder().decode(bytes));
    }
    await Bun.write(
        join(archive, "manifest.json"),
        JSON.stringify({ current: [...pending], files: dates }),
    );
}

/** Find local build dependencies in HTML, module imports and CSS URLs. */
export function assetReferences(text: string): string[] {
    return [
        ...text.matchAll(
            /(?:\/_build\/assets\/|["'(]\.\/)([\w.-]+\.(?:js|css|woff2?|svg|png|webp))/g,
        ),
    ].map((match) => match[1]);
}

/** An HTML fallback with status 200 is still a broken module response. */
export function validateAsset(response: Response, name: string) {
    const type = response.headers.get("Content-Type") ?? "";
    if (
        !response.ok ||
        (name.endsWith(".js") && !/(?:javascript|ecmascript)/i.test(type)) ||
        (name.endsWith(".css") && !/text\/css/i.test(type))
    )
        throw new Error(`Invalid asset ${name}: HTTP ${response.status}, ${type}`);
}

if (import.meta.main) {
    const [current, archive, origin] = process.argv.slice(2);
    if (!current || !archive)
        throw new Error("Usage: assets.ts <built-assets> <archive> [bootstrap-origin]");
    if (!(await Bun.file(join(archive, "manifest.json")).exists())) {
        if (!origin) throw new Error("An initial production origin is required.");
        await archiveLiveAssets(origin, archive);
    }
    await retainAssets(current, archive);
}
