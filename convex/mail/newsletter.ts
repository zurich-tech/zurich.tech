import { isListed } from "../events/visibility";
import { newsDate } from "../news/path";
import { openJobs } from "../jobs/jobs";
import { select } from "./audiences";
import { recipientsLocked } from "./policy";
import type { Doc } from "../_generated/dataModel";
import { newsletterEdition, newsletterEmail } from "./templates";
import { create } from "./campaigns";
import { links } from "./personalization";
import { v } from "convex/values";
import { query, mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { activeSponsors } from "../sponsorships/organisations";
import { requireAdmin } from "../auth/access";
import { profileInvitation, profilePlaceholder } from "./involvement";
import { attendanceCopy, resourcesPlaceholder } from "./attendance";

/** Read all upcoming published events for the digest preview. */
export const preview = query({
    args: {
        profile: v.optional(v.union(v.literal("create"), v.literal("complete"), v.literal("none"))),
    },
    handler: async (ctx, args) => {
        // restrict newsletter controls to the team
        const { memberId } = await requireAdmin(ctx);
        const now = Date.now();

        // read upcoming published events in chronological order
        const entries = await ctx.db
            .query("events")
            .withIndex("by_status_and_start", (range) =>
                range.eq("status", "scheduled").gte("startsAt", now),
            )
            .collect();

        // use the same eligibility rules for the preview and the actual edition
        const subscribers = await select(ctx, { kind: "subscribers" }, "weekly");

        // include only the sponsor placements promised by each tier
        const sponsors = await activeSponsors(ctx);

        const jobs = await openJobs(ctx);
        const news = digestNews(await ctx.db.query("posts").collect(), now);
        const edition = newsletterEmail(
            newsletterEdition(digestEvents(entries, now), sponsors, jobs, { news, date: now }),
        );
        const invitation = profileInvitation(args.profile ?? "create");
        const resources = await attendanceCopy(
            ctx,
            { kind: "resources", since: now - 7 * 86400000, until: now },
            "",
            memberId,
        );
        return {
            jobs: jobs.length,
            news: news.length,
            isPaused: (await ctx.db.query("mailSchedules").unique())?.isPaused ?? true,
            html: edition.html
                .replaceAll(profilePlaceholder.html, invitation.html)
                .replaceAll(resourcesPlaceholder.html, () => resources.html),
            events: digestEvents(entries, now),
            subscribers: subscribers.recipients.length,
        };
    },
});

/** Pause or resume automatic weekly mail. */
export const pause = mutation({
    args: { isPaused: v.boolean() },
    handler: async (ctx, args) => {
        // restrict newsletter controls to the team
        await requireAdmin(ctx);
        const settings = await ctx.db.query("mailSchedules").unique();
        if (settings) await ctx.db.patch(settings._id, args);
        else await ctx.db.insert("mailSchedules", args);
    },
});

/** Queue one weekly edition at Monday 08:00 Zurich time, skipping empty weeks. */
export const tick = internalMutation({
    args: {},
    handler: async (ctx) => {
        // send only during the Monday morning window in Zurich
        const now = new Date();
        const local = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Europe/Zurich",
            weekday: "short",
            hour: "2-digit",
            hourCycle: "h23",
        }).formatToParts(now);
        if (
            local.find((part) => part.type === "weekday")?.value !== "Mon" ||
            local.find((part) => part.type === "hour")?.value !== "08"
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
        const settings = await ctx.db.query("mailSchedules").unique();
        if (!settings || settings.isPaused || settings?.lastWeek === week || recipientsLocked())
            return;
        const bulk = await ctx.db.query("mailPolicy").unique();
        if (!bulk || bulk.isPaused) return;

        // read upcoming published events in chronological order
        const entries = await ctx.db
            .query("events")
            .withIndex("by_status_and_start", (range) =>
                range.eq("status", "scheduled").gte("startsAt", now.getTime()),
            )
            .collect();
        const selected = digestEvents(entries, now.getTime());
        const jobs = await openJobs(ctx);
        const news = digestNews(await ctx.db.query("posts").collect(), now.getTime());
        if (selected.length === 0 && jobs.length === 0 && news.length === 0) return;

        // include only the sponsor placements promised by each tier
        const sponsors = await activeSponsors(ctx);
        const edition = newsletterEdition(selected, sponsors, jobs, { news, date: now.getTime() });

        // queue bounded batches rather than one scheduled job per subscriber here
        await ctx.scheduler.runAfter(0, internal.mail.newsletter.queue, {
            week,
            eventIds: selected.map((event) => event._id),
            ...edition,
            cursor: null,
        });
        if (settings) await ctx.db.patch(settings._id, { lastWeek: week });
        else await ctx.db.insert("mailSchedules", { isPaused: false, lastWeek: week });
    },
});

/** Create the edition; the campaign owns recipient batching. */
export const queue = internalMutation({
    args: {
        week: v.string(),
        eventIds: v.array(v.id("events")),
        text: v.string(),
        html: v.string(),
        preview: v.optional(v.string()),
        date: v.optional(v.number()),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args): Promise<string | null> => {
        await create(ctx, {
            key: `digest:${args.week}`,
            eventIds: args.eventIds,
            audience: { kind: "subscribers" },
            category: "weekly",
            expiresAt: Date.now() + 7 * 86400000,
            content: newsletterEmail(args, links.unsubscribe),
        });
        return null;
    },
});

/** Include the coming week's recurring occurrences alongside standalone announcements. */
export function digestEvents(events: Doc<"events">[], now: number) {
    return events.filter(
        (event) => isListed(event) && (!event.scheduleId || event.startsAt < now + 7 * 86400000),
    );
}

/** Select the five latest published stories by story date, excluding future dates. */
export function digestNews(posts: Doc<"posts">[], now: number) {
    return posts
        .filter(
            (post) =>
                post.published &&
                post.publishedAt !== undefined &&
                post.publishedAt <= now &&
                newsDate(post) <= now,
        )
        .sort(
            (left, right) =>
                newsDate(right) - newsDate(left) || left.slug.localeCompare(right.slug),
        )
        .slice(0, 5)
        .map((post) => ({
            slug: post.slug,
            date: newsDate(post),
            title: post.published!.title,
            description: post.published!.description,
            ...(post.published!.image ? { image: post.published!.image } : {}),
        }));
}
