import { isListed } from "../events/visibility";
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { receivesAnnouncement } from "./events";
import { create } from "./campaigns";
import { links } from "./personalization";
import { seriesEmail } from "./templates";
import { activeSponsors } from "../sponsorships/organisations";
import { openJobs } from "../jobs/jobs";

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
        const events = await ctx.db
            .query("events")
            .withIndex("by_schedule_and_occurrence", (q) => q.eq("scheduleId", schedule._id))
            .collect();
        if (
            !events.some(
                (event) =>
                    isListed(event) && event.status === "scheduled" && event.startsAt > Date.now(),
            )
        )
            return;
        const subscriptions = await ctx.db
            .query("subscriptions")
            .withIndex("by_status", (q) => q.eq("status", "subscribed"))
            .collect();
        await create(
            ctx,
            {
                key: `series:${series._id}`,
                eventIds: events.filter(isListed).map((event) => event._id),
                audience: { kind: "subscribers" },
                category: "announcement",
                seriesId: series._id,
                content: seriesEmail(series, schedule.recurrence, links.unsubscribe, {
                    sponsors: await activeSponsors(ctx),
                    jobs: await openJobs(ctx),
                }),
            },
            subscriptions
                .filter((row) => receivesAnnouncement(row, args.publishedAt))
                .map((row) => row._id),
        );
    },
});
