import { validatePrimaryOrganiser, validateCoOrganisers } from "./organisers";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireSeries, requireWorkspace } from "../auth/grants";
import { allows } from "../auth/permissions";

/** Private revisions never appear in public directory queries. */
export const workspace = query({
    args: {},
    handler: async (ctx) => {
        const access = await requireWorkspace(ctx);
        const series = (await ctx.db.query("series").collect()).filter((item) =>
            allows(access, { seriesId: item._id }),
        );
        return await Promise.all(
            series.map(async (item) => {
                const draft = await ctx.db
                    .query("seriesRevisions")
                    .withIndex("by_series", (q) => q.eq("seriesId", item._id))
                    .unique();
                return {
                    ...item,
                    ...(draft
                        ? {
                              name: draft.name,
                              primaryOrganiserId: draft.primaryOrganiserId,
                              coOrganiserIds: draft.coOrganiserIds,
                              slug: draft.slug,
                              description: draft.description,
                              topics: draft.topics,
                          }
                        : {}),
                    hasDraft: !!draft,
                };
            }),
        );
    },
});

/** Upsert one recurring event series. */
export const upsert = mutation({
    args: {
        id: v.optional(v.id("series")),
        primaryOrganiserId: v.optional(v.id("members")),
        coOrganiserIds: v.optional(v.array(v.id("members"))),
        publish: v.optional(v.boolean()),
        slug: v.string(),
        name: v.string(),
        description: v.string(),
        topics: v.array(v.string()),
    },
    handler: async (ctx, args) => {
        // authorise draft preparation separately from publication
        await requireSeries(ctx, args.id, args.publish ? "organiser" : "editor");
        const { id, publish, ...values } = args;
        values.primaryOrganiserId = args.primaryOrganiserId;
        values.coOrganiserIds = args.coOrganiserIds;
        await validateCoOrganisers(ctx, values.coOrganiserIds);
        await validatePrimaryOrganiser(ctx, values.primaryOrganiserId);
        if (!id && !publish) throw new Error("Publish a new series before assigning editors.");
        if (!values.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug))
            throw new Error("Enter a name and valid slug.");
        if (
            values.name.length > 200 ||
            values.slug.length > 160 ||
            values.description.length > 20000 ||
            values.topics.length > 12 ||
            values.topics.some((topic) => topic.length > 60)
        )
            throw new Error("Series content is too long.");

        // reject another series using the same URL
        const existing = await ctx.db
            .query("series")
            .withIndex("by_slug", (range) => range.eq("slug", values.slug))
            .unique();
        if (existing && existing._id !== id) throw new Error("A series already uses this URL.");
        // update the existing series or create its first record
        if (id) {
            if (!(await ctx.db.get(id))) throw new Error("Series not found.");
            const draft = await ctx.db
                .query("seriesRevisions")
                .withIndex("by_series", (q) => q.eq("seriesId", id))
                .unique();
            if (publish) {
                await ctx.db.patch(id, values);
                if (draft) await ctx.db.delete(draft._id);
            } else if (draft) await ctx.db.patch(draft._id, { ...values, updatedAt: Date.now() });
            else
                await ctx.db.insert("seriesRevisions", {
                    ...values,
                    seriesId: id,
                    updatedAt: Date.now(),
                });

            return id;
        }

        return await ctx.db.insert("series", { ...values, status: "active" });
    },
});

/** Archive a series and pause recurrence without removing its history. */
export const archive = mutation({
    args: { id: v.id("series"), isArchived: v.boolean() },
    handler: async (ctx, args) => {
        await requireSeries(ctx, args.id);
        if (!(await ctx.db.get(args.id))) throw new Error("Series not found.");
        await ctx.db.patch(args.id, { status: args.isArchived ? "archived" : "active" });

        // restoration leaves schedules paused until explicitly resumed
        if (args.isArchived) {
            const schedules = await ctx.db
                .query("schedules")
                .withIndex("by_series", (q) => q.eq("seriesId", args.id))
                .collect();
            for (const schedule of schedules)
                await ctx.db.patch(schedule._id, { status: "paused", updatedAt: Date.now() });
        }
    },
});
