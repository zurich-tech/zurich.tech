import { publicLinks } from "./links";
import { isPublicMember, memberHandle } from "./identity";
import { isListed } from "../events/visibility";
import { organiserIds } from "../events/organisers";
import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { paidTerm } from "../billing/coverage";
import { calendarRow } from "../events/queries";

/** Visibility admitted by public directory queries. */
const publicVisibility = "public" as const;

/** Read every active public member. */
export const membersList = query({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db
            .query("members")
            .withIndex("by_status", (query) => query.eq("status", "active"))
            .filter((query) => query.eq(query.field("visibility"), publicVisibility))
            .collect();

        return await Promise.all(rows.map((member) => memberRow(ctx, member)));
    },
});

/** Read one active public member by handle. */
export const member = query({
    args: { handle: v.string() },
    handler: async (ctx, args) => {
        const handle = await ctx.db
            .query("handles")
            .withIndex("by_name", (query) => query.eq("name", args.handle))

            .unique();

        if (handle === null || handle.status !== "active") {
            return null;
        }

        const member = await ctx.db.get(handle.memberId);
        if (!isPublicMember(member)) {
            return null;
        }

        const events = await ctx.db.query("events").collect();
        const series = await ctx.db.query("series").collect();
        const seriesOrganisers = new Map(series.map((item) => [item._id, item]));
        const entries = await Promise.all(
            events
                .filter((event) => {
                    const ids = organiserIds(
                        event,
                        event.seriesId ? seriesOrganisers.get(event.seriesId) : undefined,
                    );
                    return (
                        isListed(event) &&
                        (ids.primary === member._id || ids.others.includes(member._id))
                    );
                })
                .map((event) => calendarRow(ctx, event)),
        );

        // show patron recognition only with the member's consent
        const patron = await ctx.db
            .query("sponsorships")
            .withIndex("by_member", (q) => q.eq("memberId", member._id))
            .unique();

        const term = patron?.isPublic ? await paidTerm(ctx, patron._id) : null;

        return {
            ...(await memberRow(ctx, member)),
            sponsorTier: term !== null && term.endsAt > Date.now() ? patron?.tier : undefined,
            isSpeaker: (
                await ctx.db
                    .query("speakers")
                    .withIndex("by_member", (q) => q.eq("memberId", member._id))
                    .collect()
            ).some(
                (row) =>
                    !row.isRemoved &&
                    events.some((event) => event._id === row.eventId && isListed(event)),
            ),
            hostedEvents: entries,
        };
    },
});

/** Resolve one active public member handle. */
export const handle = query({
    args: { handle: v.string() },
    handler: async (ctx, args) => {
        const handle = await ctx.db
            .query("handles")
            .withIndex("by_name", (query) => query.eq("name", args.handle))
            .filter((query) => query.eq(query.field("status"), "active"))
            .unique();

        if (handle === null) {
            return null;
        }

        const member = await ctx.db.get(handle.memberId);

        return !isPublicMember(member)
            ? null
            : {
                  href: `/members/${handle.name}`,
                  summary: member.headline,
                  title: member.name,
                  type: "member",
              };
    },
});

/** Expand one public member profile. */
async function memberRow(ctx: QueryCtx, member: Doc<"members">) {
    const handle = await memberHandle(ctx, member._id);
    if (handle === null) {
        throw new Error(`Public member ${member._id} has no active handle.`);
    }

    return {
        id: member._id,
        avatarUrl: member.avatarUrl,
        avatarDarkUrl: member.avatarDarkUrl,
        bio: member.bio,
        handle: handle.name,
        headline: member.headline,
        affiliations: member.affiliations,
        links: await publicLinks(ctx, member._id),
        name: member.name,
        status: member.status,
        visibility: member.visibility,
    };
}
