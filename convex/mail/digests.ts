import type { Doc } from "../_generated/dataModel";
import { newsletterEdition, newsletterEmail } from "./templates";
import { siteOrigin } from "../auth/environment";
import { v } from "convex/values";
import { query, mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { activeSponsors } from "../sponsorships/organisations";
import { requireTeam } from "../auth/access";
import { enqueue } from "./deliveries";

/** Read all upcoming published events for the digest preview. */
export const preview = query({
    args: {},
    handler: async (ctx) => {
        // restrict newsletter controls to the team
        await requireTeam(ctx);
        const now = Date.now();

        // read upcoming published events in chronological order
        const entries = await ctx.db
            .query("events")
            .withIndex("by_status_and_start", (range) =>
                range.eq("status", "scheduled").gte("startsAt", now),
            )
            .collect();

        // include recent delivery failures in the preview
        const deliveries = await ctx.db
            .query("deliveries")
            .withIndex("by_status", (range) => range.eq("status", "failed"))
            .take(30);

        // count newsletter recipients who enabled the weekly digest
        const subscribers = await ctx.db
            .query("subscriptions")
            .withIndex("by_status", (range) => range.eq("status", "subscribed"))
            .collect();

        // include only the sponsor placements promised by each tier
        const sponsors = await activeSponsors(ctx);

        return {
            html: newsletterEmail(newsletterEdition(digestEvents(entries, now), sponsors)).html,
            events: digestEvents(entries, now),
            subscribers: subscribers.filter((row) => row.weekly !== false).length,
            failures: deliveries.map((row) => ({
                id: row._id,
                to: row.to,
                subject: row.subject,
                error: row.error,
            })),
        };
    },
});

/** Pause or resume automatic weekly mail. */
export const pause = mutation({
    args: { isPaused: v.boolean() },
    handler: async (ctx, args) => {
        // restrict newsletter controls to the team
        await requireTeam(ctx);
        const settings = await ctx.db.query("digests").unique();
        if (settings) await ctx.db.patch(settings._id, args);
        else await ctx.db.insert("digests", args);
    },
});

/** Queue one weekly edition at Monday 09:00 Zürich time, skipping empty weeks. */
export const tick = internalMutation({
    args: {},
    handler: async (ctx) => {
        // send only during the Monday morning window in Zürich
        const now = new Date();
        const local = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Zurich",
            weekday: "short",
            hour: "2-digit",
            hourCycle: "h23",
        }).formatToParts(now);
        if (
            local.find((part) => part.type === "weekday")?.value !== "Mon" ||
            local.find((part) => part.type === "hour")?.value !== "09"
        )
            return;
        if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
            throw new Error("Weekly digest cannot send: email delivery is not configured.");

        // skip paused or already queued editions
        const week = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Europe/Zurich",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(now);
        const settings = await ctx.db.query("digests").unique();
        if (settings?.isPaused || settings?.lastWeek === week) return;

        // read upcoming published events in chronological order
        const entries = await ctx.db
            .query("events")
            .withIndex("by_status_and_start", (range) =>
                range.eq("status", "scheduled").gte("startsAt", now.getTime()),
            )
            .collect();
        const selected = digestEvents(entries, now.getTime());
        if (selected.length === 0) return;

        // include only the sponsor placements promised by each tier
        const sponsors = await activeSponsors(ctx);
        const edition = newsletterEdition(selected, sponsors);

        // queue bounded batches rather than one scheduled job per subscriber here
        await ctx.scheduler.runAfter(0, internal.mail.digests.queue, {
            week,
            ...edition,
            cursor: null,
        });
        if (settings) await ctx.db.patch(settings._id, { lastWeek: week });
        else await ctx.db.insert("digests", { isPaused: false, lastWeek: week });
    },
});

/** Queue one bounded page of recipients and schedule the next page. */
export const queue = internalMutation({
    args: {
        week: v.string(),
        text: v.string(),
        html: v.string(),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args): Promise<string | null> => {
        // bound both transaction work and scheduled deliveries to one hundred recipients
        const page = await ctx.db
            .query("subscriptions")
            .withIndex("by_status", (range) => range.eq("status", "subscribed"))
            .paginate({ numItems: 100, cursor: args.cursor });
        for (const [position, subscriber] of page.page.entries()) {
            if (subscriber.token && subscriber.weekly !== false) {
                const message = newsletterEmail(
                    args,
                    `${siteOrigin()}/unsubscribe?token=${encodeURIComponent(subscriber.token)}`,
                );
                await enqueue(
                    ctx,
                    `digest:${args.week}:${subscriber._id}`,
                    subscriber.email,
                    message.subject,
                    message.text,
                    subscriber._id,
                    position * 600,
                    message.html,
                    { category: "weekly" },
                );
            }
        }

        // continue at the same delivery pace without crossing mutation scheduling limits
        if (!page.isDone) {
            await ctx.scheduler.runAfter(page.page.length * 600, internal.mail.digests.queue, {
                ...args,
                cursor: page.continueCursor,
            });
        }

        return page.isDone ? null : page.continueCursor;
    },
});

/** Include the coming week's recurring occurrences alongside standalone announcements. */
export function digestEvents(events: Doc<"events">[], now: number) {
    return events.filter((event) => !event.scheduleId || event.startsAt < now + 7 * 86400000);
}
