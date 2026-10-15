import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { attribution } from "../events/attribution";

/** Apply reviewed attribution without changing programmes or delivery settings. */
export const classify = internalMutation({
    args: {
        series: v.array(v.object({ slug: v.string(), attribution })),
        events: v.optional(v.array(v.object({ slug: v.string(), attribution }))),
        apply: v.boolean(),
    },
    handler: async (ctx, args) => {
        // reject incomplete or duplicated selections before writing any record
        if (
            !args.series.length ||
            args.series.length > 100 ||
            new Set(args.series.map((item) => item.slug)).size !== args.series.length
        )
            throw new ConvexError("Select between 1 and 100 distinct series.");
        const reviewed = [];
        for (const item of args.series) {
            const series = await ctx.db
                .query("series")
                .withIndex("by_slug", (q) => q.eq("slug", item.slug))
                .unique();
            if (!series) throw new ConvexError(`Series not found: ${item.slug}.`);
            reviewed.push({
                id: series._id,
                slug: series.slug,
                before: series.attribution ?? "external",
                attribution: item.attribution,
            });
        }

        // classify explicitly reviewed standalone events without inferring from their titles
        const events = args.events ?? [];
        if (events.length > 100 || new Set(events.map((item) => item.slug)).size !== events.length)
            throw new ConvexError("Select at most 100 distinct events.");
        const reviewedEvents = [];
        for (const item of events) {
            const event = await ctx.db
                .query("events")
                .withIndex("by_slug", (q) => q.eq("slug", item.slug))
                .unique();
            if (!event) throw new ConvexError(`Event not found: ${item.slug}.`);
            reviewedEvents.push({ id: event._id, slug: event.slug, attribution: item.attribution });
        }

        // update only the approved attribution, leaving private revisions untouched
        if (args.apply) {
            for (const item of reviewed)
                await ctx.db.patch(item.id, { attribution: item.attribution });
            for (const item of reviewedEvents)
                await ctx.db.patch(item.id, { attribution: item.attribution });
        }

        return { applied: args.apply, series: reviewed, events: reviewedEvents };
    },
});
