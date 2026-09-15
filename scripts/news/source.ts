import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const directory = resolve(import.meta.dir, "../../content/news");

/** Read validated import sources without coupling them to the application build. */
export async function readArticles() {
    const articles = [];
    // validate the small collection before emitting any source
    for (const filename of (await readdir(directory)).filter(
        (name) => name.endsWith(".md") && name !== "README.md",
    )) {
        const source = await readFile(resolve(directory, filename), "utf8");
        const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source);
        if (!match) throw new Error(`Missing frontmatter in ${filename}.`);
        const metadata = Bun.YAML.parse(match[1]) as Record<string, unknown>;
        for (const field of ["title", "subtitle", "date"]) {
            if (typeof metadata[field] !== "string" || !metadata[field].trim())
                throw new Error(`Missing ${field} in ${filename}.`);
        }

        // distinguish external briefs from articles without duplicating their summaries as bodies
        const kind = metadata.kind;
        if (kind !== "post" && kind !== "link")
            throw new Error(`Invalid kind in ${filename}. Use post or link.`);
        const url = metadata.url;
        if (kind === "link") {
            if (typeof url !== "string") throw new Error(`Missing URL in ${filename}.`);
            const parsed = new URL(url);
            if (parsed.protocol !== "https:" || parsed.username || parsed.password)
                throw new Error(`Invalid source URL in ${filename}.`);
        } else if (url !== undefined || !match[2].trim()) {
            throw new Error(`Posts require a body and no external URL in ${filename}.`);
        }

        // keep references explicit: public member handles and organisation slugs
        const references: Record<string, string[]> = {};
        for (const field of ["authors", "organisations"]) {
            const values = metadata[field] ?? [];
            if (
                !Array.isArray(values) ||
                new Set(values).size !== values.length ||
                values.some(
                    (value) =>
                        typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
                )
            )
                throw new Error(`Invalid ${field} in ${filename}.`);
            references[field] = values;
        }

        // keep news categories separate from technology topics and member interests
        const category = metadata.category;
        if (category !== undefined && category !== "funding")
            throw new Error(`Invalid category in ${filename}.`);

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
        if (
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
            !Number.isFinite(date) ||
            new Date(date).toISOString().slice(0, 10) !== metadata.date
        )
            throw new Error(`Invalid slug or date in ${filename}.`);
        articles.push({
            slug,
            kind,
            ...(category ? { category } : {}),
            ...(kind === "link" ? { url: String(url) } : {}),
            title: String(metadata.title),
            description: String(metadata.subtitle),
            authors: references.authors,
            organisations: references.organisations,
            date,
            topics: [...new Set(topics)] as string[],
            body: match[2].trim(),
        });
    }

    // emit one deterministic catalogue consumed by both news routes
    articles.sort((left, right) => right.date - left.date || left.slug.localeCompare(right.slug));
    return articles;
}
