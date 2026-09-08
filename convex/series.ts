import { v } from "convex/values";
import { mutation } from "./_generated/server";
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
