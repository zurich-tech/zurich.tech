import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { requireTeam } from "./access";

/** Upsert one recurring event series. */
export const upsert = mutation({
    args: {
        id: v.optional(v.id("series")),
        slug: v.string(),
        name: v.string(),
        description: v.string(),
        topics: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        // restrict series editing to the team
        await requireTeam(ctx);
        const { id, ...values } = args;
        if (!values.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug))
            throw new Error("Enter a name and valid slug.");

        // reject another series using the same URL
        const existing = await ctx.db
            .query("series")
            .withIndex("by_slug", (range) => range.eq("slug", values.slug))
            .unique();
        if (existing && existing._id !== id) throw new Error("A series already uses this URL.");
        // update the existing series or create its first record
        if (id) {
            await ctx.db.patch(id, values);

            return id;
        }

        return await ctx.db.insert("series", { ...values, status: "active" });
    },
});

/** Consolidate duplicate series and their published and editable event references. */
export const merge = internalMutation({
    args: { from: v.string(), into: v.string(), apply: v.boolean() },
    handler: async (ctx, args) => {
        if (args.from === args.into) throw new Error("Choose two different series.");
        const source = await ctx.db
            .query("series")
            .withIndex("by_slug", (q) => q.eq("slug", args.from))
            .unique();
        const target = await ctx.db
            .query("series")
            .withIndex("by_slug", (q) => q.eq("slug", args.into))
            .unique();
        if (!target) throw new Error("Destination series not found.");
        if (!source) return { events: [], submissions: 0, merged: false };
        // migrate both published events and revisions before removing the duplicate
        const events = await ctx.db
            .query("events")
            .filter((q) => q.eq(q.field("seriesId"), source._id))
            .collect();
        const submissions = await ctx.db
            .query("submissions")
            .filter((q) => q.eq(q.field("seriesId"), source._id))
            .collect();
        if (args.apply) {
            for (const event of events) await ctx.db.patch(event._id, { seriesId: target._id });
            for (const submission of submissions)
                await ctx.db.patch(submission._id, { seriesId: target._id });
            await ctx.db.delete(source._id);
        }
        return {
            events: events.map((event) => event.slug),
            submissions: submissions.length,
            merged: args.apply,
        };
    },
});
