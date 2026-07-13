import type { GenericId as Id } from "convex/values";
import { mutationGeneric as mutation } from "convex/server";
import type { GenericMutationCtx } from "convex/server";

import { archiveEvents, archiveSeries, type ArchiveEvent } from "./archive";

type MutationCtx = GenericMutationCtx<any>;

/** Populate the development database. */
export const run = mutation({
    args: {},
    handler: async (ctx) => {
        // members
        const now = Date.now();
        const staff = await ensureMember(ctx, {
            bio: "Runs zurich.tech.",
            email: "hello@zurich.tech",
            handle: "staff",
            headline: "zurich.tech",
            name: "zurich.tech",
        });
        const zurichAi = await ensureMember(ctx, {
            bio: "Machine learning meetups in Zurich since 2019.",
            email: "hello@zurichai.ch",
            handle: "zurichai",
            headline: "Machine learning meetups in Zurich.",
            name: "Zurich AI",
        });

        // member links
        await ensureLink(ctx, "member", staff, "other", "email", "mailto:hello@zurich.tech", 0);
        await ensureLink(
            ctx,
            "member",
            zurichAi,
            "website",
            "website",
            "https://www.zurichai.ch",
            0,
        );
        await ensureLink(ctx, "member", zurichAi, "x", "x", "https://x.com/zurichai", 1);
        await ensureLink(
            ctx,
            "member",
            zurichAi,
            "linkedin",
            "linkedin",
            "https://www.linkedin.com/company/zurichai",
            2,
        );

        // venues
        const venueIds = {
            "eth-ai-center-14": await ensureVenue(ctx, {
                accessNotes: "OAT building, 14th floor.",
                address: {
                    countryCode: "CH",
                    line1: "Andreasstrasse 5",
                    line2: "OAT, 14th floor",
                    locality: "Zürich",
                    postalCode: "8050",
                },
                name: "ETH AI Center, 14th floor",
            }),
            "eth-ai-center-19": await ensureVenue(ctx, {
                accessNotes: "OAT building, 19th floor.",
                address: {
                    countryCode: "CH",
                    line1: "Andreasstrasse 5",
                    line2: "OAT, 19th floor",
                    locality: "Zürich",
                    postalCode: "8050",
                },
                name: "ETH AI Center, 19th floor",
            }),
        };

        // series
        const seriesIds = {} as Record<ArchiveEvent["series"], Id<"series">>;
        for (const item of archiveSeries) {
            const seriesId = await ensureSeries(ctx, {
                description: item.description,
                ownerMemberId: zurichAi,
                slug: item.slug,
                title: item.title,
            });
            seriesIds[item.slug] = seriesId;

            await tag(ctx, "series", seriesId, item.tags);
        }

        // events
        for (const item of archiveEvents) {
            const eventId = await ensureEvent(ctx, {
                description: item.description,
                endsAt: Date.parse(item.endsAt),
                format: "talk",
                location: "ETH AI Center",
                ownerMemberId: zurichAi,
                seriesId: seriesIds[item.series],
                slug: item.slug,
                source: "event",
                startsAt: Date.parse(item.startsAt),
                status: "finished",
                title: item.title,
                venueId: venueIds[item.venue],
            });

            await ensureSpeakers(ctx, eventId, item.speakers ?? []);
            await ensureLink(ctx, "event", eventId, "website", "zurichai.ch", item.url, 0);
            await tag(ctx, "event", eventId, item.tags);
        }

        // archive post
        await ensurePost(ctx, {
            authorMemberId: staff,
            body: [
                "The Zurich AI event archive now lives on zurich.tech.",
                "ZurichCV, ZurichNLP, and ZurichRobotics events from 2024 onward are available here.",
            ],
            publishedAt: now,
            slug: "zurich-ai-archive",
            summary: "ZurichCV, ZurichNLP, and ZurichRobotics.",
            title: "Zurich AI archive",
        });

        // member tags
        await tag(ctx, "member", zurichAi, ["machine-learning", "events"]);
        await tag(ctx, "member", staff, ["events", "operations"]);

        return { events: archiveEvents.length, ok: true, series: archiveSeries.length };
    },
});

async function ensureMember(
    ctx: MutationCtx,
    args: { bio: string; email: string; handle: string; headline: string; name: string },
) {
    const now = Date.now();
    const existingHandle = await ctx.db
        .query("handles")
        .withIndex("by_name", (q: any) => q.eq("name", args.handle))
        .first();

    if (existingHandle !== null) {
        await ctx.db.patch(existingHandle.subjectId as Id<"members">, {
            bio: args.bio,
            headline: args.headline,
            name: args.name,
            status: "active",
            updatedAt: now,
            visibility: "public",
        });
        return existingHandle.subjectId as Id<"members">;
    }

    const memberId = await ctx.db.insert("members", {
        bio: args.bio,
        createdAt: now,
        headline: args.headline,
        name: args.name,
        status: "active",
        updatedAt: now,
        visibility: "public",
    });
    await ctx.db.insert("handles", {
        createdAt: now,
        name: args.handle,
        status: "active",
        subject: "member",
        subjectId: memberId,
        updatedAt: now,
    });
    await ctx.db.insert("memberEmails", {
        createdAt: now,
        email: args.email,
        isPrimary: true,
        memberId,
        source: "seed",
        updatedAt: now,
        verifiedAt: now,
    });

    return memberId;
}

async function ensureLink(
    ctx: MutationCtx,
    subject: "member" | "event" | "series",
    subjectId: Id<"members"> | Id<"events"> | Id<"series">,
    kind: "website" | "github" | "linkedin" | "x" | "mastodon" | "youtube" | "newsletter" | "other",
    label: string,
    url: string,
    position: number,
) {
    const existing = (
        await ctx.db
            .query("links")
            .withIndex("by_subject_and_subjectId", (q: any) =>
                q.eq("subject", subject).eq("subjectId", subjectId),
            )
            .collect()
    ).find((link) => link.url === url);
    const now = Date.now();

    if (existing !== undefined) {
        await ctx.db.patch(existing._id, { kind, label, position, updatedAt: now });
        return;
    }

    await ctx.db.insert("links", {
        createdAt: now,
        kind,
        label,
        position,
        subject,
        subjectId,
        updatedAt: now,
        url,
        visibility: "public",
    });
}

async function ensureVenue(
    ctx: MutationCtx,
    args: {
        accessNotes: string;
        address: {
            countryCode: string;
            line1: string;
            line2?: string;
            locality: string;
            postalCode?: string;
        };
        name: string;
    },
) {
    const now = Date.now();
    const existing = (await ctx.db.query("venues").collect()).find(
        (venue) => venue.name === args.name,
    );

    // update the existing venue and address
    if (existing !== undefined) {
        await ctx.db.patch(existing.addressId, { ...args.address, updatedAt: now });
        await ctx.db.patch(existing._id, {
            accessNotes: args.accessNotes,
            status: "active",
            updatedAt: now,
        });

        return existing._id;
    }

    // create the address before its venue
    const addressId = await ctx.db.insert("addresses", {
        ...args.address,
        createdAt: now,
        updatedAt: now,
    });

    return await ctx.db.insert("venues", {
        accessNotes: args.accessNotes,
        addressId,
        createdAt: now,
        name: args.name,
        status: "active",
        updatedAt: now,
    });
}

async function ensureSeries(
    ctx: MutationCtx,
    args: { description: string; ownerMemberId: Id<"members">; slug: string; title: string },
) {
    const now = Date.now();
    const existing = await ctx.db
        .query("series")
        .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
        .first();

    if (existing !== null) {
        await ctx.db.patch(existing._id, {
            description: args.description,
            ownerMemberId: args.ownerMemberId,
            status: "active",
            title: args.title,
            updatedAt: now,
        });
        return existing._id;
    }

    return await ctx.db.insert("series", {
        createdAt: now,
        description: args.description,
        ownerMemberId: args.ownerMemberId,
        slug: args.slug,
        status: "active",
        title: args.title,
        updatedAt: now,
    });
}

async function ensureEvent(
    ctx: MutationCtx,
    args: {
        capacity?: number;
        description: string;
        endsAt: number;
        format: "meetup" | "talk" | "workshop" | "hackathon" | "office_hours" | "other";
        location: string;
        ownerMemberId: Id<"members">;
        seriesId?: Id<"series">;
        slug: string;
        source: "event" | "manual" | "external";
        startsAt: number;
        status?: "scheduled" | "conditional" | "finished";
        title: string;
        venueId: Id<"venues">;
    },
) {
    const now = Date.now();
    const status = args.status ?? "scheduled";
    const existing = await ctx.db
        .query("events")
        .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
        .first();
    const eventId =
        existing?._id ??
        (await ctx.db.insert("events", {
            capacity: args.capacity,
            createdAt: now,
            description: args.description,
            endsAt: args.endsAt,
            format: args.format,
            ownerMemberId: args.ownerMemberId,
            seriesId: args.seriesId,
            slug: args.slug,
            startsAt: args.startsAt,
            status,
            title: args.title,
            updatedAt: now,
            venueId: args.venueId,
        }));

    if (existing !== null) {
        await ctx.db.patch(eventId, {
            capacity: args.capacity,
            description: args.description,
            endsAt: args.endsAt,
            format: args.format,
            seriesId: args.seriesId,
            startsAt: args.startsAt,
            status,
            title: args.title,
            updatedAt: now,
            venueId: args.venueId,
        });
    }

    const entry = await ctx.db
        .query("calendarEntries")
        .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
        .first();
    const calendarFields = {
        endsAt: args.endsAt,
        eventId,
        href: `/events/${args.slug}`,
        location: args.location,
        slug: args.slug,
        source: args.source,
        startsAt: args.startsAt,
        status: "published" as const,
        summary: args.description,
        timezone: "Europe/Zurich",
        title: args.title,
        updatedAt: now,
    };

    if (entry === null) {
        await ctx.db.insert("calendarEntries", {
            ...calendarFields,
            createdAt: now,
        });
    } else {
        await ctx.db.patch(entry._id, calendarFields);
    }

    return eventId;
}

async function ensureSpeakers(
    ctx: MutationCtx,
    eventId: Id<"events">,
    speakers: Array<{ name: string; title: string }>,
) {
    const now = Date.now();
    const existing = await ctx.db
        .query("eventSpeakers")
        .withIndex("by_eventId", (q: any) => q.eq("eventId", eventId))
        .collect();

    // replace existing speakers
    for (const speaker of existing) {
        await ctx.db.delete(speaker._id);
    }

    // insert the published speakers in order
    await Promise.all(
        speakers.map((speaker, position) =>
            ctx.db.insert("eventSpeakers", {
                ...speaker,
                createdAt: now,
                eventId,
                position,
                updatedAt: now,
            }),
        ),
    );
}

async function ensurePost(
    ctx: MutationCtx,
    args: {
        authorMemberId: Id<"members">;
        body: string[];
        publishedAt: number;
        slug: string;
        summary: string;
        title: string;
    },
) {
    const existing = await ctx.db
        .query("posts")
        .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
        .first();
    const now = Date.now();
    const fields = {
        authorMemberId: args.authorMemberId,
        body: args.body,
        publishedAt: args.publishedAt,
        slug: args.slug,
        status: "published" as const,
        summary: args.summary,
        title: args.title,
        updatedAt: now,
    };

    if (existing !== null) {
        await ctx.db.patch(existing._id, fields);
        return;
    }

    await ctx.db.insert("posts", {
        ...fields,
        createdAt: now,
    });
}

async function tag(
    ctx: MutationCtx,
    subject: "event" | "series" | "member",
    subjectId: Id<"events"> | Id<"series"> | Id<"members">,
    slugs: string[],
) {
    for (const slug of slugs) {
        const tagId = await ensureTag(ctx, subject, slug);
        const existing = await ctx.db
            .query("taggings")
            .withIndex("by_subject_and_subjectId", (q: any) =>
                q.eq("subject", subject).eq("subjectId", subjectId),
            )
            .collect();

        if (existing.some((tagging) => tagging.tagId === tagId)) {
            continue;
        }

        await ctx.db.insert("taggings", {
            createdAt: Date.now(),
            subject,
            subjectId,
            tagId,
        });
    }
}

async function ensureTag(ctx: MutationCtx, subject: "event" | "series" | "member", slug: string) {
    const existing = (
        await ctx.db
            .query("tags")
            .withIndex("by_slug", (q: any) => q.eq("slug", slug))
            .collect()
    ).find((tag) => tag.subject === subject);

    if (existing !== undefined) {
        return existing._id;
    }

    const now = Date.now();
    return await ctx.db.insert("tags", {
        createdAt: now,
        name: slug,
        slug,
        subject,
        updatedAt: now,
    });
}
