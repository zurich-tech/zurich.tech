/** One researched organisation from content/organisations. */
type Record = {
    slug: string;
    name: string;
    kind: string;
    headline: string;
    description: string;
    website: string;
    logo?: string;
    mapLogo?: string;
    icon?: string;
    address: { locality: string } & { [field: string]: string | number };
};

/** The researched organisations, relative to this script. */
const source = new URL("../../content/organisations/organisations.json", import.meta.url);

/** Organisations sent per Convex call. */
const batchSize = 20;

/** Import researched organisations into an explicitly chosen deployment, with a dry run by default. */
async function main() {
    const [deployment, mode] = process.argv.slice(2);
    if (!["dev", "prod"].includes(deployment) || (mode !== undefined && mode !== "--apply"))
        throw new Error("Usage: bun scripts/organisations/import.ts <dev|prod> [--apply]");

    // map research records onto stored fields, with logos and site icons served from public/logos
    const records: Record[] = await Bun.file(source).json();
    const organisations = [];
    for (const record of records) {
        const { logo, mapLogo, icon, address } = record;
        if (!mapLogo && !icon) throw new Error(`Icon missing for ${record.slug}.`);
        for (const path of [logo, mapLogo, icon])
            if (
                path &&
                !(await Bun.file(new URL(`../../public/${path}`, import.meta.url)).exists())
            )
                throw new Error(`Logo missing from public/${path}.`);
        organisations.push({
            slug: record.slug,
            name: record.name,
            kind: record.kind,
            headline: record.headline,
            description: record.description,
            website: record.website,
            logoUrl: logo && `/${logo}`,
            mapLogoUrl: (mapLogo ?? icon) && `/${mapLogo ?? icon}`,
            address: {
                ...address,
                locality: address.locality === "Zürich" ? "Zurich" : address.locality,
            },
        });
    }

    // validate every batch before writing any; reruns skip existing slugs
    for (const apply of mode === "--apply" ? [false, true] : [false]) {
        const totals = { created: 0, existing: 0 };
        for (let offset = 0; offset < organisations.length; offset += batchSize) {
            const child = Bun.spawn(
                [
                    "bunx",
                    "convex",
                    "run",
                    ...(deployment === "prod" ? ["--prod"] : []),
                    "organisations/imports:apply",
                    JSON.stringify({
                        apply,
                        organisations: organisations.slice(offset, offset + batchSize),
                    }),
                ],
                { stdout: "pipe", stderr: "inherit" },
            );
            const output = await new Response(child.stdout).text();
            if (await child.exited)
                throw new Error(`Import stopped at batch ${offset / batchSize + 1}.`);
            const result = JSON.parse(output);
            totals.created += result.created;
            totals.existing += result.existing;
        }
        console.log({ deployment, apply, ...totals });
    }
}
await main();
