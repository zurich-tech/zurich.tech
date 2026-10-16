import { query, mutation, type QueryCtx } from "../_generated/server";
import { requireTeam } from "../auth/access";
import { ConvexError, v } from "convex/values";
import { validateHierarchy } from "./catalogue";
import { retiredInterests } from "../members/interests";

/** Include archived labels so existing content remains intelligible. */
export const list = query({
    args: {},
    handler: async (ctx) =>
        (await ctx.db.query("topics").collect()).sort((a, b) => a.name.localeCompare(b.name)),
});

/** Let the team curate the catalogue without renaming existing keys. */
export const save = mutation({
    args: {
        slug: v.string(),
        name: v.string(),
        isActive: v.boolean(),
        parent: v.optional(v.union(v.string(), v.null())),
    },
    handler: async (ctx, args) => {
        await requireTeam(ctx);
        const name = args.name.trim();
        if (
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug) ||
            args.slug.length > 60 ||
            !name ||
            name.length > 60
        )
            throw new ConvexError("Enter a short name and a lowercase key with hyphens.");
        const existing = await ctx.db
            .query("topics")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .unique();
        const topics = await ctx.db.query("topics").collect();

        // preserve omitted parents and validate the complete proposed hierarchy before writing
        const parent = args.parent === undefined ? existing?.parent : (args.parent ?? undefined);
        const values = { slug: args.slug, name, isActive: args.isActive, parent };
        validateHierarchy([...topics.filter((topic) => topic.slug !== args.slug), values]);
        if (existing) await ctx.db.patch(existing._id, values);
        else await ctx.db.insert("topics", values);
    },
});

/** Accept only distinct catalogue keys; archived choices may be retained, not newly assigned. */
export async function validateTopics(ctx: QueryCtx, values: string[], previous: string[] = []) {
    if (values.length > 12 || new Set(values).size !== values.length)
        throw new ConvexError("Choose at most 12 distinct topics.");
    for (const slug of values) {
        const topic = await ctx.db
            .query("topics")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique();
        if (!topic || (!topic.isActive && !previous.includes(slug)))
            throw new ConvexError(`Choose an available topic: ${slug}.`);
    }
}

/** Retain retired member answers without allowing new assignments or changing shared topics. */
export async function validateInterests(ctx: QueryCtx, values: string[], previous: string[] = []) {
    await validateTopics(ctx, values, previous);
    for (const slug of values) {
        if (Object.hasOwn(retiredInterests, slug) && !previous.includes(slug))
            throw new ConvexError(`Choose an available interest: ${slug}.`);
    }
}

/** Accept organisation subjects only when no selected topic contains another selection. */
export async function validateSpecificTopics(
    ctx: QueryCtx,
    values: string[],
    previous: string[] = [],
) {
    // retain the shared availability, archival and size rules
    await validateTopics(ctx, values, previous);
    const topics = await ctx.db.query("topics").collect();
    const parents = new Map(topics.map((topic) => [topic.slug, topic.parent]));
    const selected = new Set(values);

    // reject redundant ancestors without silently changing reviewed assignments
    for (const slug of values) {
        const visited = new Set([slug]);
        let parent = parents.get(slug);
        while (parent !== undefined) {
            if (visited.has(parent))
                throw new ConvexError(`Topic hierarchy contains a cycle: ${parent}.`);
            if (!parents.has(parent)) throw new ConvexError(`Unknown parent topic: ${parent}.`);
            if (selected.has(parent))
                throw new ConvexError(`Choose specific topics without ancestors: ${parent}.`);
            visited.add(parent);
            parent = parents.get(parent);
        }
    }
}
