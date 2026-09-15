import { readArticles } from "./source";

/** Import reviewed news into an explicitly chosen deployment, with a dry run by default. */
async function main() {
    const [deployment, recordedBy, mode] = process.argv.slice(2);
    if (
        !["dev", "prod"].includes(deployment) ||
        !recordedBy ||
        (mode !== undefined && mode !== "--apply")
    )
        throw new Error(
            "Usage: bun scripts/news/import.ts <dev|prod> <recording-member-id> [--apply]",
        );
    const articles = (await readArticles()).map(({ slug, date, ...content }) => ({
        slug,
        date,
        content,
    }));
    // validate every batch before writing any; reruns skip identical published records
    for (const apply of mode === "--apply" ? [false, true] : [false]) {
        const totals = { created: 0, unchanged: 0 };
        for (let offset = 0; offset < articles.length; offset += 20) {
            const child = Bun.spawn(
                [
                    "bunx",
                    "convex",
                    "run",
                    ...(deployment === "prod" ? ["--prod"] : []),
                    "news/imports:apply",
                    JSON.stringify({
                        recordedBy,
                        apply,
                        articles: articles.slice(offset, offset + 20),
                    }),
                ],
                { stdout: "pipe", stderr: "inherit" },
            );
            const output = await new Response(child.stdout).text();
            if (await child.exited) throw new Error(`Import stopped at batch ${offset / 20 + 1}.`);
            const result = JSON.parse(output);
            totals.created += result.created;
            totals.unchanged += result.unchanged;
        }
        console.log({ deployment, apply, ...totals });
    }
}
await main();
