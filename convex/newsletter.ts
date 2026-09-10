import { siteOrigin } from "./environment";
import { tiers } from "../shared/plans";
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { activeSponsors } from "./sponsors";
import { requireTeam } from "./access";
import { enqueue } from "./mail";

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
            .withIndex("by_status_and_startsAt", (range) =>
                range.eq("status", "scheduled").gte("startsAt", now),
            )
            .collect();

        // include recent delivery failures in the preview
        const deliveries = await ctx.db
            .query("deliveries")
            .withIndex("by_status", (range) => range.eq("status", "failed"))
            .take(30);

        // count only verified newsletter recipients
        const subscribers = await ctx.db
            .query("subscriptions")
            .withIndex("by_status", (range) => range.eq("status", "subscribed"))
            .collect();

        // include only the sponsor placements promised by each tier
        const sponsors = await activeSponsors(ctx);

        return {
            html: renderEdition(entries, sponsors),
            events: entries,
            subscribers: subscribers.filter((row) => row.verifiedAt !== undefined).length,
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
        const settings = await ctx.db.query("digest").unique();
        if (settings) await ctx.db.patch(settings._id, args);
        else await ctx.db.insert("digest", args);
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
        const settings = await ctx.db.query("digest").unique();
        if (settings?.isPaused || settings?.lastWeek === week) return;
        // read upcoming published events in chronological order
        const entries = await ctx.db
            .query("events")
            .withIndex("by_status_and_startsAt", (range) =>
                range.eq("status", "scheduled").gte("startsAt", now.getTime()),
            )
            .collect();
        if (entries.length === 0) return;
        // include only the sponsor placements promised by each tier
        const sponsors = await activeSponsors(ctx);
        const recognition = tiers
            .filter((tier) => tier.newsletter)
            .map((tier) => {
                const entries = sponsors.filter((sponsor) => sponsor.tier === tier.id);

                return entries.length
                    ? `${tier.name} sponsors\n${entries.map((sponsor) => `${sponsor.name} · ${sponsor.website}`).join("\n")}`
                    : "";
            })
            .filter(Boolean)
            .join("\n\n");

        // render event details for plain text email
        const eventsText = entries
            .map(
                (entry) =>
                    `${entry.title}\n${new Date(entry.startsAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich" })} · ${entry.location ?? "Zürich"}\n${entry.summary ?? ""}\n${siteOrigin()}/events/${entry.slug}`,
            )
            .join("\n\n");
        const text = [eventsText, recognition].filter(Boolean).join("\n\n");

        // queue bounded batches rather than one scheduled job per subscriber here
        await ctx.scheduler.runAfter(0, internal.newsletter.queue, {
            week,
            text,
            html: renderEdition(entries, sponsors),
            cursor: null,
        });
        if (settings) await ctx.db.patch(settings._id, { lastWeek: week });
        else await ctx.db.insert("digest", { isPaused: false, lastWeek: week });
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
            if (subscriber.verifiedAt !== undefined && subscriber.token) {
                await enqueue(
                    ctx,
                    `digest:${args.week}:${subscriber._id}`,
                    subscriber.email,
                    "This week in Zürich · zurich.tech",
                    `Here’s what’s coming up in Zürich’s tech community.\nAll times are Zürich local time.\n\n${args.text}\n\nUnsubscribe: ${siteOrigin()}/unsubscribe?token=${subscriber.token}`,
                    subscriber._id,
                    position * 600,
                    `${args.html}<p style="text-align:center;font:12px Arial;padding:24px"><a href="${escapeHtml(siteOrigin())}/unsubscribe?token=${encodeURIComponent(subscriber.token)}">Unsubscribe</a></p>`,
                );
            }
        }

        // continue at the same delivery pace without crossing mutation scheduling limits
        if (!page.isDone) {
            await ctx.scheduler.runAfter(page.page.length * 600, internal.newsletter.queue, {
                ...args,
                cursor: page.continueCursor,
            });
        }

        return page.isDone ? null : page.continueCursor;
    },
});

/** Render the same edition for the workspace preview and delivered email. */
function renderEdition(
    entries: Doc<"events">[],
    sponsors: Awaited<ReturnType<typeof activeSponsors>>,
) {
    // render escaped event links and descriptions
    const events = entries
        .map((entry) => {
            const url = `${siteOrigin()}/events/${entry.slug}`;
            const time = new Date(entry.startsAt).toLocaleString("en-GB", {
                timeZone: "Europe/Zurich",
            });

            return `<section style="padding:24px 0;border-bottom:1px solid #d3d7df"><h2 style="font-size:20px;margin:0 0 8px"><a style="color:#174ed8" href="${escapeHtml(url)}">${escapeHtml(entry.title)}</a></h2><p>${escapeHtml(time)} · ${escapeHtml(entry.location ?? "Zürich")}</p><p>${escapeHtml(entry.summary ?? "")}</p></section>`;
        })
        .join("");

    // render eligible sponsor logos in tier order
    const recognition = tiers
        .filter((tier) => tier.newsletter)
        .map((tier) => {
            const selected = sponsors.filter((sponsor) => sponsor.tier === tier.id);
            if (!selected.length) return "";
            const logos = selected
                .map(
                    (sponsor) =>
                        `<a href="${escapeHtml(sponsor.website)}" style="display:inline-block;padding:12px;color:#174ed8">${sponsor.logoUrl ? `<img src="${escapeHtml(new URL(sponsor.logoUrl, siteOrigin()).href)}" alt="${escapeHtml(sponsor.name)}" width="${tier.logoWidth}" style="max-height:80px;object-fit:contain">` : escapeHtml(sponsor.name)}</a>`,
                )
                .join("");

            return `<section style="padding:20px 0"><h2 style="font-size:14px">${tier.name} sponsors</h2>${logos}</section>`;
        })
        .join("");

    return `<div style="max-width:640px;margin:auto;padding:24px;font:15px/1.5 Arial,sans-serif;color:#17253c;background:#fafaf8"><header style="padding:24px;background:#174ed8;color:white;font:bold 28px monospace">zurich.tech</header><h1 style="font-size:24px">Upcoming events</h1><p>All times are Zürich local time.</p>${events}${recognition}</div>`;
}

/** Escape dynamic email text and attributes. */
function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
