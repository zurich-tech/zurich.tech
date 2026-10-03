import { query, mutation, type QueryCtx } from "../_generated/server";
import { requireTeam } from "../auth/access";
import { v } from "convex/values";

/** Include archived labels so existing content remains intelligible. */
export const list = query({
    args: {},
    handler: async (ctx) =>
        (await ctx.db.query("topics").collect()).sort((a, b) => a.name.localeCompare(b.name)),
});

/** Let the team curate the catalogue without renaming existing keys. */
export const save = mutation({
    args: { slug: v.string(), name: v.string(), isActive: v.boolean() },
    handler: async (ctx, args) => {
        await requireTeam(ctx);
        const name = args.name.trim();
        if (
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug) ||
            args.slug.length > 60 ||
            !name ||
            name.length > 60
        )
            throw new Error("Enter a short name and a lowercase key with hyphens.");
        const existing = await ctx.db
            .query("topics")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .unique();
        const duplicate = (await ctx.db.query("topics").collect()).find(
            (topic) => topic.slug !== args.slug && topic.name.toLowerCase() === name.toLowerCase(),
        );
        if (duplicate) throw new Error("A topic already uses this name.");
        if (existing) await ctx.db.patch(existing._id, { name, isActive: args.isActive });
        else await ctx.db.insert("topics", { ...args, name });
    },
});

/** Accept only distinct catalogue keys; archived choices may be retained, not newly assigned. */
export async function validateTopics(ctx: QueryCtx, values: string[], previous: string[] = []) {
    if (values.length > 12 || new Set(values).size !== values.length)
        throw new Error("Choose at most 12 distinct topics.");
    for (const slug of values) {
        const topic = await ctx.db
            .query("topics")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique();
        if (!topic || (!topic.isActive && !previous.includes(slug)))
            throw new Error(`Choose an available topic: ${slug}.`);
    }
}
