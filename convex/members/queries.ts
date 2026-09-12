import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { paidTerm } from "../billing/payments";
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
        if (
            member === null ||
            member.status !== "active" ||
            member.visibility !== publicVisibility
        ) {
            return null;
        }

        const events = await ctx.db.query("events").collect();
        const entries = await Promise.all(
            events
                .filter(
                    (event) =>
                        event.status !== "draft" && (event.organiserIds ?? []).includes(member._id),
                )
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
                    events.some((event) => event._id === row.eventId && event.status !== "draft"),
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

        return member === null ||
            member.status !== "active" ||
            member.visibility !== publicVisibility
            ? null
            : {
                  href: `/members/${handle.name}`,
                  summary: member.headline,
                  title: member.name,
                  type: "member",
              };
    },
});

/** Find the active handle for one member. */
export async function memberHandle(ctx: QueryCtx, memberId: Id<"members">) {
    return await ctx.db
        .query("handles")
        .withIndex("by_member", (query) => query.eq("memberId", memberId))
        .filter((query) => query.eq(query.field("status"), "active"))
        .unique();
}

/** Read the public links attached to one record. */
export async function publicLinks(ctx: QueryCtx, subjectId: Id<"members"> | Id<"events">) {
    const links = await ctx.db
        .query("links")
        .withIndex("by_owner", (query) => query.eq("ownerId", subjectId))
        .filter((query) => query.eq(query.field("visibility"), publicVisibility))
        .collect();

    return links
        .sort((left, right) => left.position - right.position)
        .map((link) => ({
            href: link.url,
            label: link.label ?? link.kind,
        }));
}

/** Read the sorted tag slugs attached to one record. */
async function memberTags(ctx: QueryCtx, memberId: Id<"members">) {
    const taggings = await ctx.db
        .query("taggings")
        .withIndex("by_member", (query) => query.eq("memberId", memberId))
        .collect();
    const tags = await Promise.all(taggings.map((tagging) => ctx.db.get(tagging.tagId)));

    return tags
        .map((tag) => {
            // reject broken tagging references
            if (tag === null) {
                throw new Error("A member tagging refers to a missing tag.");
            }

            return tag.slug;
        })
        .sort();
}

/** Expand one public member profile. */
async function memberRow(ctx: QueryCtx, member: Doc<"members">) {
    const handle = await memberHandle(ctx, member._id);
    if (handle === null) {
        throw new Error(`Public member ${member._id} has no active handle.`);
    }
    const tags = await memberTags(ctx, member._id);

    return {
        avatarUrl: member.avatarUrl,
        avatarDarkUrl: member.avatarDarkUrl,
        bio: member.bio,
        handle: handle.name,
        headline: member.headline,
        interests: tags,
        links: await publicLinks(ctx, member._id),
        name: member.name,
        status: member.status,
        visibility: member.visibility,
    };
}
