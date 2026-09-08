import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(import.meta.dir, "../content/news");
const output = resolve(import.meta.dir, "../shared/news.generated.ts");

/** Compile authored Markdown and its metadata into the site's article catalogue. */
async function generate() {
    const articles = [];

    // validate the small collection before emitting any source
    for (const filename of (await readdir(directory)).filter((name) => name.endsWith(".md"))) {
        const source = await readFile(resolve(directory, filename), "utf8");
        const match = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(source);
        if (!match) throw new Error(`Missing frontmatter in ${filename}.`);
        const metadata = Bun.YAML.parse(match[1]) as Record<string, unknown>;
        for (const field of ["title", "subtitle", "date", "author"]) {
            if (typeof metadata[field] !== "string" || !metadata[field].trim())
                throw new Error(`Missing ${field} in ${filename}.`);
        }

        // derive stable routes from filenames and preserve authored Markdown
        const slug = filename.slice(0, -3);
        const date = Date.parse(String(metadata.date) + "T12:00:00Z");
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isFinite(date))
            throw new Error(`Invalid slug or date in ${filename}.`);
        articles.push({
            slug,
            title: String(metadata.title),
            description: String(metadata.subtitle),
            author: String(metadata.author),
            date,
            tags: [] as string[],
            body: match[2].trim(),
        });
    }

    // emit one deterministic catalogue consumed by both news routes
    articles.sort((left, right) => right.date - left.date || left.slug.localeCompare(right.slug));
    await writeFile(
        output,
        `/** Authored news compiled by scripts/news.ts. */\nexport const articles = ${JSON.stringify(articles, null, 4)};\n`,
    );
}

await generate();
