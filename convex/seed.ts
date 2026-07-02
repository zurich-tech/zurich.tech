import type { GenericId as Id } from "convex/values";
import { mutationGeneric as mutation } from "convex/server";
import type { GenericMutationCtx } from "convex/server";

type MutationCtx = GenericMutationCtx<any>;

export const run = mutation({
    args: {},
    handler: async (ctx) => {
        // reference point so seeded events stay relative to whenever seed runs
        const now = Date.now();
        const days = (count: number) => count * 24 * 60 * 60 * 1000;
        const hours = (count: number) => count * 60 * 60 * 1000;
        const staff = await ensureMember(ctx, {
            bio: "Staff account for events, members, and email.",
            email: "hello@zurich.tech",
            handle: "staff",
            headline: "Events, members, and email.",
            name: "zurich.tech staff",
        });
        const zurichAi = await ensureMember(ctx, {
            bio: "AI events, mailing list, and Zurich AI archive.",
            email: "hello@zurichai.ch",
            handle: "zurichai",
            headline: "AI events and announcements.",
            name: "Zurich AI",
        });

        await ensureLink(ctx, "member", staff, "other", "email", "mailto:hello@zurich.tech", 0);
        await ensureLink(ctx, "member", zurichAi, "x", "x", "https://x.com/zurichai", 0);
        await ensureLink(
            ctx,
            "member",
            zurichAi,
            "linkedin",
            "linkedin",
            "https://www.linkedin.com/company/zurichai",
            1,
        );

        const kreis4 = await ensureVenue(ctx, {
            accessNotes: "Room and entry notes are sent after RSVP.",
            address: {
                countryCode: "CH",
                line1: "Kreis 4",
                locality: "Zurich",
            },
            capacity: 120,
            name: "Kreis 4 venue",
        });
        const online = await ensureVenue(ctx, {
            accessNotes: "Video link is sent by email.",
            address: {
                countryCode: "CH",
                line1: "Online",
                locality: "Zurich",
            },
            capacity: 40,
            name: "Online",
        });
        const eth = await ensureVenue(ctx, {
            accessNotes: "Campus room is confirmed to RSVP holders.",
            address: {
                countryCode: "CH",
                line1: "ETH Zurich, Zentrum",
                locality: "Zurich",
            },
            capacity: 35,
            name: "ETH Zurich",
        });
        const hardwareLab = await ensureVenue(ctx, {
            accessNotes: "Badge access is arranged after RSVP.",
            address: {
                countryCode: "CH",
                line1: "Hardware Lab",
                locality: "Zurich",
            },
            capacity: 60,
            name: "Hardware Lab",
        });

        const aiSeries = await ensureSeries(ctx, {
            description: "Talks, demos, and applied AI.",
            ownerMemberId: zurichAi,
            slug: "zurich-ai",
            title: "Zurich AI",
        });
        const systemsSeries = await ensureSeries(ctx, {
            description: "Runtime, infrastructure, distributed systems, and papers.",
            ownerMemberId: staff,
            slug: "systems-reading-group",
            title: "Systems Reading Group",
        });
        await ensureSeriesRecurrence(ctx, aiSeries, {
            frequency: "monthly",
            interval: 1,
            startsAt: now + days(8) + hours(6),
            timezone: "Europe/Zurich",
        });
        await ensureSeriesSubscription(ctx, aiSeries, staff);
        await ensureSeriesSubscription(ctx, aiSeries, zurichAi);

        const builders = await ensureEvent(ctx, {
            capacity: 120,
            description: "Short talks, demos, and time for people building with AI.",
            endsAt: now + days(8) + hours(9),
            format: "meetup",
            location: "Kreis 4",
            ownerMemberId: zurichAi,
            seriesId: aiSeries,
            slug: "zurich-ai-builders-night",
            source: "event",
            startsAt: now + days(8) + hours(6),
            title: "Zurich AI Builders Night",
            venueId: kreis4,
        });
        await ensureAgenda(ctx, builders, [
            ["18:30", "Doors and check-in"],
            ["19:00", "Builder demos"],
            ["20:15", "Open demos and hallway track"],
        ]);
        await ensureSpeaker(ctx, builders, "Zurich AI", "Community demos", 0);
        await ensureSpeaker(ctx, builders, "Guest builders", "Lightning talks", 1);
        await ensureRsvps(ctx, builders, 74);

        // next monthly occurrence in the same series, so seriesNextAt resolves
        const buildersNext = await ensureEvent(ctx, {
            capacity: 120,
            description: "Short talks, demos, and time for people building with AI.",
            endsAt: now + days(38) + hours(9),
            format: "meetup",
            location: "Kreis 4",
            ownerMemberId: zurichAi,
            seriesId: aiSeries,
            slug: "zurich-ai-builders-night-next",
            source: "event",
            startsAt: now + days(38) + hours(6),
            title: "Zurich AI Builders Night — Next Session",
            venueId: kreis4,
        });
        await ensureRsvps(ctx, buildersNext, 9);

        const officeHours = await ensureEvent(ctx, {
            capacity: 40,
            description: "Projects, event ideas, and introductions.",
            endsAt: now + days(15) + hours(7),
            format: "office_hours",
            location: "Online",
            ownerMemberId: staff,
            slug: "community-office-hours",
            source: "manual",
            startsAt: now + days(15) + hours(5),
            title: "Community Office Hours",
            venueId: online,
        });
        await ensureAgenda(ctx, officeHours, [
            ["17:00", "Open office hours"],
            ["18:00", "Introductions and project matchmaking"],
        ]);
        await ensureSpeaker(ctx, officeHours, "zurich.tech staff", "Operations", 0);
        await ensureRsvps(ctx, officeHours, 18);

        const systems = await ensureEvent(ctx, {
            capacity: 35,
            description: "Runtime design and distributed systems papers.",
            endsAt: now + days(22) + hours(9),
            format: "talk",
            location: "ETH Zurich",
            ownerMemberId: staff,
            seriesId: systemsSeries,
            slug: "systems-reading-group",
            source: "external",
            startsAt: now + days(22) + hours(7),
            title: "Systems Reading Group",
            venueId: eth,
        });
        await ensureAgenda(ctx, systems, [
            ["19:00", "Paper discussion"],
            ["20:15", "Implementation notes"],
        ]);
        await ensureSpeaker(ctx, systems, "Reading group hosts", "Systems discussion", 0);
        await ensureRsvps(ctx, systems, 21);

        const hackNight = await ensureEvent(ctx, {
            capacity: 60,
            description: "A weekend hack night for people building AI hardware.",
            endsAt: now + days(30) + hours(15),
            format: "hackathon",
            location: "Hardware Lab",
            ownerMemberId: zurichAi,
            slug: "ai-hardware-hack-night",
            source: "event",
            startsAt: now + days(29) + hours(9),
            status: "conditional",
            title: "AI Hardware Hack Night",
            venueId: hardwareLab,
        });
        await ensureRsvps(ctx, hackNight, 9);
        await ensureActivation(ctx, hackNight, {
            deadlineAt: now + days(22),
            kind: "minimum_rsvps",
            status: "pending",
            threshold: 25,
        });

        const summerSocial = await ensureEvent(ctx, {
            capacity: 120,
            description: "Season recap, lightning demos, and drinks.",
            endsAt: now - days(40) + hours(9),
            format: "meetup",
            location: "Kreis 4",
            ownerMemberId: zurichAi,
            seriesId: aiSeries,
            slug: "zurich-ai-summer-social",
            source: "event",
            startsAt: now - days(40) + hours(6),
            status: "finished",
            title: "Zurich AI Summer Social",
            venueId: kreis4,
        });
        await ensureAttendances(ctx, summerSocial, 30, now - days(40) + hours(6));

        const seasonOpener = await ensureEvent(ctx, {
            capacity: 35,
            description: "First reading group session of the season.",
            endsAt: now - days(70) + hours(9),
            format: "talk",
            location: "ETH Zurich",
            ownerMemberId: staff,
            seriesId: systemsSeries,
            slug: "systems-reading-group-season-opener",
            source: "event",
            startsAt: now - days(70) + hours(7),
            status: "finished",
            title: "Systems Reading Group — Season Opener",
            venueId: eth,
        });
        await ensureAttendances(ctx, seasonOpener, 25, now - days(70) + hours(7));

        await ensurePost(ctx, {
            authorMemberId: staff,
            body: [
                "zurich.tech tracks events, members, and email.",
                "Calendar first. Accounts, proposals, subscriptions, and email preferences next.",
            ],
            publishedAt: now,
            slug: "zurich-tech-platform",
            summary: "Events, members, and email.",
            title: "Building zurich.tech",
        });

        await tag(ctx, "event", builders, ["ai", "builders", "demos"]);
        await tag(ctx, "event", buildersNext, ["ai", "builders", "demos"]);
        await tag(ctx, "event", officeHours, ["community", "office-hours"]);
        await tag(ctx, "event", systems, ["systems", "infrastructure", "papers"]);
        await tag(ctx, "event", hackNight, ["ai", "hardware", "hackathon"]);
        await tag(ctx, "event", summerSocial, ["ai", "builders", "demos"]);
        await tag(ctx, "event", seasonOpener, ["systems", "infrastructure", "papers"]);
        await tag(ctx, "series", aiSeries, ["ai", "builders", "research"]);
        await tag(ctx, "series", systemsSeries, ["systems", "infrastructure", "papers"]);
        await tag(ctx, "member", zurichAi, ["ai", "research", "startups"]);
        await tag(ctx, "member", staff, ["events", "members", "operations"]);

        return { ok: true };
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
    subject: "member",
    subjectId: Id<"members">,
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
        address: { countryCode: string; line1: string; locality: string };
        capacity: number;
        name: string;
    },
) {
    const now = Date.now();
    const addressId = await ctx.db.insert("addresses", {
        ...args.address,
        createdAt: now,
        updatedAt: now,
    });

    return await ctx.db.insert("venues", {
        accessNotes: args.accessNotes,
        addressId,
        capacity: args.capacity,
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

async function ensureSeriesRecurrence(
    ctx: MutationCtx,
    seriesId: Id<"series">,
    args: {
        frequency: "daily" | "weekly" | "monthly" | "yearly";
        interval: number;
        startsAt: number;
        timezone: string;
    },
) {
    const now = Date.now();
    const series = await ctx.db.get(seriesId);
    if (series === null) {
        throw new Error("series not found");
    }

    if (series.recurrenceId !== undefined) {
        await ctx.db.patch(series.recurrenceId, { ...args, updatedAt: now });
        return series.recurrenceId as Id<"recurrences">;
    }

    const recurrenceId = await ctx.db.insert("recurrences", {
        ...args,
        createdAt: now,
        updatedAt: now,
    });
    await ctx.db.patch(seriesId, { recurrenceId, updatedAt: now });

    return recurrenceId;
}

async function ensureSeriesSubscription(
    ctx: MutationCtx,
    seriesId: Id<"series">,
    memberId: Id<"members">,
) {
    const now = Date.now();
    const existing = await ctx.db
        .query("seriesSubscriptions")
        .withIndex("by_seriesId_and_memberId", (q: any) =>
            q.eq("seriesId", seriesId).eq("memberId", memberId),
        )
        .first();

    if (existing !== null) {
        await ctx.db.patch(existing._id, { status: "subscribed", updatedAt: now });
        return;
    }

    await ctx.db.insert("seriesSubscriptions", {
        createdAt: now,
        memberId,
        seriesId,
        status: "subscribed",
        updatedAt: now,
    });
}

async function ensureEvent(
    ctx: MutationCtx,
    args: {
        capacity: number;
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

async function ensureAgenda(
    ctx: MutationCtx,
    eventId: Id<"events">,
    items: Array<[string, string]>,
) {
    const existing = await ctx.db
        .query("eventAgendaItems")
        .withIndex("by_eventId", (q: any) => q.eq("eventId", eventId))
        .collect();
    const now = Date.now();

    for (const item of existing) {
        await ctx.db.delete(item._id);
    }

    await Promise.all(
        items.map(([time, title], position) =>
            ctx.db.insert("eventAgendaItems", {
                createdAt: now,
                eventId,
                position,
                time,
                title,
                updatedAt: now,
            }),
        ),
    );
}

async function ensureSpeaker(
    ctx: MutationCtx,
    eventId: Id<"events">,
    name: string,
    title: string,
    position: number,
) {
    const existing = (
        await ctx.db
            .query("eventSpeakers")
            .withIndex("by_eventId", (q: any) => q.eq("eventId", eventId))
            .collect()
    ).find((speaker) => speaker.position === position);
    const now = Date.now();

    if (existing !== undefined) {
        await ctx.db.patch(existing._id, { name, title, updatedAt: now });
        return;
    }

    await ctx.db.insert("eventSpeakers", {
        createdAt: now,
        eventId,
        name,
        position,
        title,
        updatedAt: now,
    });
}

async function ensureRsvps(ctx: MutationCtx, eventId: Id<"events">, count: number) {
    const existing = await ctx.db
        .query("rsvps")
        .withIndex("by_eventId", (q: any) => q.eq("eventId", eventId))
        .collect();
    const now = Date.now();

    for (let index = existing.length; index < count; index += 1) {
        await ctx.db.insert("rsvps", {
            createdAt: now,
            email: `seed-${eventId}-${index}@example.invalid`,
            eventId,
            name: `Seed attendee ${index + 1}`,
            status: "going",
            updatedAt: now,
        });
    }
}

async function ensureActivation(
    ctx: MutationCtx,
    eventId: Id<"events">,
    args: {
        deadlineAt: number;
        kind: "minimum_rsvps" | "minimum_capacity_ratio";
        status: "pending" | "met" | "missed";
        threshold: number;
    },
) {
    const now = Date.now();
    const existing = await ctx.db
        .query("eventActivations")
        .withIndex("by_eventId", (q: any) => q.eq("eventId", eventId))
        .first();

    if (existing !== null) {
        await ctx.db.patch(existing._id, { ...args, updatedAt: now });
        return;
    }

    await ctx.db.insert("eventActivations", {
        ...args,
        createdAt: now,
        eventId,
        updatedAt: now,
    });
}

async function ensureAttendances(
    ctx: MutationCtx,
    eventId: Id<"events">,
    count: number,
    checkedInAt: number,
) {
    const existing = await ctx.db
        .query("attendances")
        .withIndex("by_eventId", (q: any) => q.eq("eventId", eventId))
        .collect();
    const now = Date.now();

    for (let index = existing.length; index < count; index += 1) {
        await ctx.db.insert("attendances", {
            checkedInAt,
            createdAt: now,
            email: `seed-attendance-${eventId}-${index}@example.invalid`,
            eventId,
            method: "qr",
        });
    }
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
