import { v } from "convex/values";
import { mutationGeneric as mutation } from "convex/server";

export const subscribe = mutation({
    args: {
        email: v.string(),
        topic: v.union(v.literal("newsletter"), v.literal("events")),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const existing = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q: any) => q.eq("email", args.email))
            .filter((q: any) => q.eq(q.field("topic"), args.topic))
            .first();

        if (existing !== null) {
            await ctx.db.patch(existing._id, {
                status: "subscribed",
                updatedAt: now,
            });
            return existing._id;
        }

        return await ctx.db.insert("subscriptions", {
            createdAt: now,
            email: args.email,
            source: "website",
            status: "subscribed",
            topic: args.topic,
            updatedAt: now,
        });
    },
});

export const requestMagicLink = mutation({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        const now = Date.now();
        const memberEmail = await ctx.db
            .query("memberEmails")
            .withIndex("by_email", (q: any) => q.eq("email", args.email))
            .first();

        const memberId =
            memberEmail?.memberId ??
            (await ctx.db.insert("members", {
                createdAt: now,
                name: args.email,
                status: "imported",
                updatedAt: now,
                visibility: "private",
            }));

        if (memberEmail === null) {
            await ctx.db.insert("memberEmails", {
                createdAt: now,
                email: args.email,
                isPrimary: true,
                memberId,
                source: "magic_link",
                updatedAt: now,
            });
        }

        return await ctx.db.insert("emails", {
            createdAt: now,
            kind: "transactional",
            memberId,
            scheduledAt: now,
            status: "queued",
            subject: "Your zurich.tech sign-in link",
            to: args.email,
            updatedAt: now,
        });
    },
});

export const proposeEvent = mutation({
    args: {
        capacity: v.optional(v.number()),
        description: v.string(),
        format: v.union(
            v.literal("meetup"),
            v.literal("talk"),
            v.literal("workshop"),
            v.literal("hackathon"),
            v.literal("office_hours"),
            v.literal("other"),
        ),
        ownerEmail: v.string(),
        startsAt: v.optional(v.number()),
        title: v.string(),
        venue: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const email = await ctx.db
            .query("memberEmails")
            .withIndex("by_email", (q: any) => q.eq("email", args.ownerEmail))
            .first();
        const ownerMemberId =
            email?.memberId ??
            (await ctx.db.insert("members", {
                createdAt: now,
                name: args.ownerEmail,
                status: "imported",
                updatedAt: now,
                visibility: "private",
            }));

        if (email === null) {
            await ctx.db.insert("memberEmails", {
                createdAt: now,
                email: args.ownerEmail,
                isPrimary: true,
                memberId: ownerMemberId,
                source: "event_proposal",
                updatedAt: now,
            });
        }

        return await ctx.db.insert("events", {
            capacity: args.capacity,
            createdAt: now,
            description: args.description,
            format: args.format,
            ownerMemberId,
            slug: slugify(args.title),
            startsAt: args.startsAt ?? now,
            status: "proposed",
            title: args.title,
            updatedAt: now,
        });
    },
});

export const proposeSeries = mutation({
    args: {
        description: v.string(),
        ownerEmail: v.string(),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const email = await ctx.db
            .query("memberEmails")
            .withIndex("by_email", (q: any) => q.eq("email", args.ownerEmail))
            .first();
        const ownerMemberId =
            email?.memberId ??
            (await ctx.db.insert("members", {
                createdAt: now,
                name: args.ownerEmail,
                status: "imported",
                updatedAt: now,
                visibility: "private",
            }));

        if (email === null) {
            await ctx.db.insert("memberEmails", {
                createdAt: now,
                email: args.ownerEmail,
                isPrimary: true,
                memberId: ownerMemberId,
                source: "series_proposal",
                updatedAt: now,
            });
        }

        return await ctx.db.insert("series", {
            createdAt: now,
            description: args.description,
            ownerMemberId,
            slug: slugify(args.title),
            status: "proposed",
            title: args.title,
            updatedAt: now,
        });
    },
});

export const rsvp = mutation({
    args: {
        email: v.string(),
        eventSlug: v.string(),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (q: any) => q.eq("slug", args.eventSlug))
            .first();

        if (event === null) {
            throw new Error("Event not found.");
        }

        const now = Date.now();
        const existing = await ctx.db
            .query("rsvps")
            .withIndex("by_eventId_and_email", (q: any) =>
                q.eq("eventId", event._id).eq("email", args.email),
            )
            .first();

        if (existing !== null) {
            await ctx.db.patch(existing._id, {
                name: args.name,
                status: "going",
                updatedAt: now,
            });
            return existing._id;
        }

        return await ctx.db.insert("rsvps", {
            createdAt: now,
            email: args.email,
            eventId: event._id,
            name: args.name,
            status: "going",
            updatedAt: now,
        });
    },
});

function slugify(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}
