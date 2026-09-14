import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(import.meta.dir, "../../content/news");
const output = resolve(import.meta.dir, "../../src/news/articles.generated.ts");

/** Compile authored Markdown and its metadata into the site's article catalogue. */
async function generate() {
    const articles = [];
    const catalogues: Record<string, Record<string, { name: string; url?: string }>> = {};

    // validate canonical tag and author identities before resolving article references
    for (const field of ["authors"]) {
        const catalogue = JSON.parse(await readFile(resolve(directory, `${field}.json`), "utf8"));
        for (const [slug, entry] of Object.entries(catalogue)) {
            const value = entry as { name?: unknown; url?: unknown };
            if (
                !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
                typeof value.name !== "string" ||
                !value.name.trim() ||
                (value.url !== undefined &&
                    (typeof value.url !== "string" || !/^(https:\/\/|\/(?!\/))/.test(value.url)))
            ) {
                throw new Error(`Invalid ${field} entry: ${slug}.`);
            }
        }
        catalogues[field] = catalogue;
    }

    // validate the small collection before emitting any source
    for (const filename of (await readdir(directory)).filter((name) => name.endsWith(".md"))) {
        const source = await readFile(resolve(directory, filename), "utf8");
        const match = /^---\n([\s\S]*?)\n---\n([\s\S]+)$/.exec(source);
        if (!match) throw new Error(`Missing frontmatter in ${filename}.`);
        const metadata = Bun.YAML.parse(match[1]) as Record<string, unknown>;
        for (const field of ["title", "subtitle", "date"]) {
            if (typeof metadata[field] !== "string" || !metadata[field].trim())
                throw new Error(`Missing ${field} in ${filename}.`);
        }

        // require explicit unique references instead of freeform author and tag spellings
        const references: Record<string, { slug: string; name: string; url?: string }[]> = {};
        for (const field of ["authors"]) {
            const values = metadata[field];
            if (
                !Array.isArray(values) ||
                values.length === 0 ||
                new Set(values).size !== values.length ||
                values.some(
                    (value) =>
                        typeof value !== "string" || !Object.hasOwn(catalogues[field], value),
                )
            ) {
                throw new Error(`Invalid ${field} in ${filename}. Use unique catalogue slugs.`);
            }
            references[field] = values.map((slug) => ({ slug, ...catalogues[field][slug] }));
        }

        const topics = metadata.topics;
        if (
            !Array.isArray(topics) ||
            topics.some(
                (topic) => typeof topic !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic),
            )
        )
            throw new Error(`Invalid topics in ${filename}.`);

        // derive stable routes from filenames and preserve authored Markdown
        const slug = filename.slice(0, -3);
        const date = Date.parse(String(metadata.date) + "T12:00:00Z");
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isFinite(date))
            throw new Error(`Invalid slug or date in ${filename}.`);
        articles.push({
            slug,
            title: String(metadata.title),
            description: String(metadata.subtitle),
            authors: references.authors,
            date,
            topics: [...new Set(topics)] as string[],
            body: match[2].trim(),
        });
    }

    // emit one deterministic catalogue consumed by both news routes
    articles.sort((left, right) => right.date - left.date || left.slug.localeCompare(right.slug));
    await writeFile(
        output,
        `/** Authored news compiled by scripts/news/build.ts. */\nexport const articles = ${JSON.stringify(articles, null, 4)};\n`,
    );
}

await generate();
