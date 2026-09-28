import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { requireAdmin } from "../auth/access";
import { siteOrigin } from "../auth/environment";
import { isListed } from "../events/visibility";
import { date } from "./history";

/** Named campaign dimensions, shared by everyone using the same public link. */
export const referral = {
    /** Public destination without a query string. */
    path: v.string(),
    /** Shared source label. */
    source: v.string(),
    /** Email, social or another delivery medium. */
    medium: v.string(),
    /** Shared campaign label. */
    campaign: v.string(),
};

/** Register a direct campaign link without a redirect or recipient identifier. */
export const create = mutation({
    args: referral,
    handler: async (ctx, args) => {
        // only administrators can introduce stored campaign labels
        await requireAdmin(ctx);
        if (!valid(args)) throw new Error("Use lowercase campaign labels and a public page path.");

        // require a public destination before generating a social link
        if (!(await register(args, ctx)))
            throw new Error("Choose a published event, article or public landing page.");

        return url(args, siteOrigin());
    },
});

/** Register shared campaign dimensions only for public destinations. */
export async function register(
    args: { path: string; source: string; medium: string; campaign: string },
    ctx: MutationCtx,
) {
    // reject private routes and malformed campaign labels
    if (!valid(args)) return false;
    const parts = args.path.split("/");
    let isPublic = ["/", "/events", "/news", "/about", "/map", "/jobs", "/sponsor"].includes(
        args.path,
    );

    // verify event publication
    if (parts.length === 3 && parts[1] === "events") {
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (q) => q.eq("slug", parts[2]))
            .unique();
        isPublic = !!event && isListed(event);
    }
    // verify article publication
    else if (parts.length === 3 && parts[1] === "news") {
        const post = await ctx.db
            .query("posts")
            .withIndex("by_slug", (q) => q.eq("slug", parts[2]))
            .unique();
        isPublic = !!post?.published;
    }
    if (!isPublic) return false;

    // reuse the same dimensions across messages and retries
    const existing = await ctx.db
        .query("referrals")
        .withIndex("by_link", (q) =>
            q
                .eq("path", args.path)
                .eq("source", args.source)
                .eq("medium", args.medium)
                .eq("campaign", args.campaign),
        )
        .unique();
    if (!existing) await ctx.db.insert("referrals", args);

    return true;
}

/** Increment a daily aggregate only for a previously registered campaign link. */
export const record = mutation({
    args: referral,
    handler: async (ctx, args) => {
        // ignore unrecognised tags without retaining any submitted values
        if (!valid(args)) return false;
        const link = await ctx.db
            .query("referrals")
            .withIndex("by_link", (q) =>
                q
                    .eq("path", args.path)
                    .eq("source", args.source)
                    .eq("medium", args.medium)
                    .eq("campaign", args.campaign),
            )
            .unique();
        if (!link) return false;

        // store counts, never individual arrival records or browser identities
        const today = date(Date.now());
        const existing = await ctx.db
            .query("arrivals")
            .withIndex("by_date_referral", (q) => q.eq("date", today).eq("referralId", link._id))
            .unique();
        if (existing) await ctx.db.patch(existing._id, { count: existing.count + 1 });
        else await ctx.db.insert("arrivals", { date: today, referralId: link._id, count: 1 });

        return true;
    },
});

/** Report the last thirty days to administrators, including links with no arrivals. */
export const list = query({
    args: {},
    handler: async (ctx) => {
        // keep campaign reports private and bound the reporting interval
        await requireAdmin(ctx);
        const today = date(Date.now());
        const since = new Date(Date.parse(today) - 29 * 86400000).toISOString().slice(0, 10);
        const arrivals = await ctx.db
            .query("arrivals")
            .withIndex("by_date_referral", (q) => q.gte("date", since))
            .collect();
        const links = await ctx.db.query("referrals").collect();

        return links.map((link) => ({
            ...link,
            url: url(link, siteOrigin()),
            days: arrivals
                .filter((row) => row.referralId === link._id)
                .map(({ date, count }) => ({ date, count })),
        }));
    },
});

/** Reject free text, query strings and private tokens before database lookups. */
function valid(value: { path: string; source: string; medium: string; campaign: string }) {
    return (
        /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)?)?$/.test(value.path) &&
        value.path.length <= 200 &&
        [value.source, value.medium, value.campaign].every((label) =>
            /^[a-z0-9][a-z0-9_-]{0,63}$/.test(label),
        )
    );
}

/** Build an ordinary destination URL using standard campaign parameters. */
function url(
    value: { path: string; source: string; medium: string; campaign: string },
    origin: string,
) {
    const result = new URL(value.path, origin);
    result.searchParams.set("utm_source", value.source);
    result.searchParams.set("utm_medium", value.medium);
    result.searchParams.set("utm_campaign", value.campaign);

    return result.href;
}
