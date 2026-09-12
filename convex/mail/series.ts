import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { receivesAnnouncement } from "./events";
import { enqueue } from "./deliveries";
import { seriesEmail } from "./templates";
import { siteOrigin } from "../auth/environment";

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
        const page = await ctx.db
            .query("subscriptions")
            .withIndex("by_status", (q) => q.eq("status", "subscribed"))
            .paginate({ numItems: 100, cursor: args.cursor });
        for (const [position, subscription] of page.page.entries()) {
            if (!receivesAnnouncement(subscription, args.publishedAt)) continue;
            const message = seriesEmail(
                series,
                schedule.recurrence,
                `${siteOrigin()}/unsubscribe?token=${encodeURIComponent(subscription.token)}`,
            );
            await enqueue(
                ctx,
                `series:${series._id}:${subscription._id}`,
                subscription.email,
                message.subject,
                message.text,
                subscription._id,
                position * 600,
                message.html,
                { category: "announcement" },
            );
        }
        if (!page.isDone)
            await ctx.scheduler.runAfter(page.page.length * 600, internal.mail.series.announce, {
                ...args,
                cursor: page.continueCursor,
            });
    },
});
