import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/** Authored display fields; identifiers, URLs and delivered messages remain unchanged. */
const fields = {
    events: ["title", "description", "summary", "location", "address"],
    submissions: ["title", "description", "summary", "location", "address"],
    series: ["name", "description"],
    seriesRevisions: ["name", "description"],
    members: ["headline", "bio", "searchText"],
    organisations: ["name", "headline", "description", "location"],
    addresses: ["label", "line1", "line2", "locality", "region"],
    venues: ["name", "accessNotes"],
    locations: ["name"],
    jobs: ["title", "description", "location"],
} as const;

/** Standardise the city's display spelling without triggering publication or mail. */
export const zurich = internalMutation({
    args: { apply: v.boolean() },
    handler: async (ctx, args) => {
        const counts: Record<string, number> = {};
        for (const table of Object.keys(fields) as (keyof typeof fields)[]) {
            // Restrict changes to the explicit display-field list for each table.
            for (const row of await ctx.db.query(table).collect()) {
                const changes: Record<string, string> = {};
                for (const field of fields[table]) {
                    const value = (row as Record<string, unknown>)[field];
                    if (typeof value === "string" && value.includes("Zürich"))
                        changes[field] = value.replaceAll("Zürich", "Zurich");
                }
                if (!Object.keys(changes).length) continue;
                counts[table] = (counts[table] ?? 0) + 1;
                if (args.apply) await ctx.db.patch(row._id, changes);
            }
        }
        // Recurring templates and editorial snapshots must not restore the old spelling.
        for (const row of await ctx.db.query("schedules").collect()) {
            const template = normalise(row.template);
            if (JSON.stringify(template) !== JSON.stringify(row.template)) {
                counts.schedules = (counts.schedules ?? 0) + 1;
                if (args.apply) await ctx.db.patch(row._id, { template });
            }
        }
        for (const row of await ctx.db.query("posts").collect()) {
            const draft = normalise(row.draft);
            const published = normalise(row.published);
            if (JSON.stringify([draft, published]) !== JSON.stringify([row.draft, row.published])) {
                counts.posts = (counts.posts ?? 0) + 1;
                if (args.apply) await ctx.db.patch(row._id, { draft, published });
            }
        }
        for (const table of ["members", "speakers"] as const) {
            for (const row of await ctx.db.query(table).collect()) {
                const affiliations = normalise(row.affiliations);
                if (JSON.stringify(affiliations) === JSON.stringify(row.affiliations)) continue;
                counts[table] = (counts[table] ?? 0) + 1;
                if (args.apply) await ctx.db.patch(row._id, { affiliations });
            }
        }
        return { applied: args.apply, counts };
    },
});

/** Normalise only authored text within nested content; preserve URLs and identifiers. */
function normalise<T>(value: T): T {
    if (Array.isArray(value)) return value.map(normalise) as T;
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [
            key,
            typeof entry === "string" &&
            [
                "title",
                "description",
                "body",
                "summary",
                "location",
                "address",
                "role",
                "organisation",
            ].includes(key)
                ? entry.replaceAll("Zürich", "Zurich")
                : normalise(entry),
        ]),
    ) as T;
}
