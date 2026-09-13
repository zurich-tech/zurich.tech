import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { receivesAnnouncement } from "./events";
import { create } from "./campaigns";
import { links } from "./personalization";
import { seriesEmail } from "./templates";

/** Announce a recurring programme once while respecting global event preferences. */
export const announce = internalMutation({
    args: {
        scheduleId: v.id("schedules"),
        publishedAt: v.number(),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        const schedule = await ctx.db.get(args.scheduleId);
        if (!schedule || schedule.status !== "active") return;
        const series = await ctx.db.get(schedule.seriesId);
        if (!series || !series.announcedAt) return;
        const subscriptions = await ctx.db
            .query("subscriptions")
            .withIndex("by_status", (q) => q.eq("status", "subscribed"))
            .collect();
        await create(
            ctx,
            {
                key: `series:${series._id}`,
                audience: { kind: "subscribers" },
                category: "announcement",
                seriesId: series._id,
                content: seriesEmail(series, schedule.recurrence, links.unsubscribe),
            },
            subscriptions
                .filter((row) => receivesAnnouncement(row, args.publishedAt))
                .map((row) => row._id),
        );
    },
});
