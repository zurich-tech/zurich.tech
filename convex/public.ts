import { v } from "convex/values";
import type { GenericId as Id } from "convex/values";
import { queryGeneric as query } from "convex/server";
import type { GenericQueryCtx } from "convex/server";

type QueryCtx = GenericQueryCtx<any>;
type Doc<Table extends string> = {
    _id: Id<Table>;
    [key: string]: any;
};

const publicVisibility = "public" as const;

async function handleFor(ctx: QueryCtx, subject: "member", subjectId: Id<"members">) {
    return await ctx.db
        .query("handles")
        .withIndex("by_subject_and_subjectId", (q: any) =>
            q.eq("subject", subject).eq("subjectId", subjectId),
        )
        .filter((q: any) => q.eq(q.field("status"), "active"))
        .first();
}

async function linksFor(
    ctx: QueryCtx,
    subject: "member" | "event" | "series",
    subjectId: Id<"members"> | Id<"events"> | Id<"series">,
) {
    const links = await ctx.db
        .query("links")
        .withIndex("by_subject_and_subjectId", (q: any) =>
            q.eq("subject", subject).eq("subjectId", subjectId),
        )
        .filter((q: any) => q.eq(q.field("visibility"), publicVisibility))
        .collect();

    return links
        .sort((left, right) => left.position - right.position)
        .map((link) => ({
            href: link.url,
            label: link.label ?? link.kind,
        }));
}

async function tagsFor(
    ctx: QueryCtx,
    subject: "event" | "series" | "member",
    subjectId: Id<"events"> | Id<"series"> | Id<"members">,
) {
    const taggings = await ctx.db
        .query("taggings")
        .withIndex("by_subject_and_subjectId", (q: any) =>
            q.eq("subject", subject).eq("subjectId", subjectId),
        )
        .collect();
    const tags = await Promise.all(taggings.map((tagging) => ctx.db.get(tagging.tagId)));

    return tags
        .filter((tag): tag is Doc<"tags"> => tag !== null)
        .map((tag) => tag.slug)
        .sort();
}

async function calendarRow(ctx: QueryCtx, entry: Doc<"calendarEntries">) {
    const base = {
        endsAt: entry.endsAt,
        eventId: entry.eventId,
        href: entry.href ?? `/events/${entry.slug}`,
        id: entry._id,
        location: entry.location,
        slug: entry.slug,
        source: entry.source,
        startsAt: entry.startsAt,
        status: entry.status,
        summary: entry.summary,
        timezone: entry.timezone,
        title: entry.title,
    };

    // manual and external entries carry no product data
    if (entry.eventId === undefined) {
        return base;
    }
    const event = await ctx.db.get(entry.eventId);
    if (event === null) {
        return base;
    }

    // rsvp gauge
    const rsvps = await ctx.db
        .query("rsvps")
        .withIndex("by_eventId", (q: any) => q.eq("eventId", event._id))
        .collect();
    const rsvpCount = rsvps.filter((rsvp: any) => rsvp.status === "going").length;

    // attendance for finished events
    const attendances =
        event.status === "finished"
            ? await ctx.db
                  .query("attendances")
                  .withIndex("by_eventId", (q: any) => q.eq("eventId", event._id))
                  .collect()
            : [];

    // speakers in position order
    const speakerRows = await ctx.db
        .query("eventSpeakers")
        .withIndex("by_eventId", (q: any) => q.eq("eventId", event._id))
        .collect();
    const speakers = speakerRows
        .sort((left: any, right: any) => left.position - right.position)
        .map((speaker: any) => speaker.name);

    // series membership, cadence, and the next occurrence
    let seriesTitle: string | undefined;
    let seriesSlug: string | undefined;
    let cadence: string | undefined;
    let seriesNextAt: number | undefined;
    if (event.seriesId !== undefined) {
        const series = await ctx.db.get(event.seriesId);
        if (series !== null) {
            seriesTitle = series.title;
            seriesSlug = series.slug;
            if (series.recurrenceId !== undefined) {
                const recurrence = await ctx.db.get(series.recurrenceId);
                cadence = recurrence === null ? undefined : cadenceText(recurrence);
            }
            const next = await ctx.db
                .query("events")
                .withIndex("by_seriesId_and_startsAt", (q: any) =>
                    q.eq("seriesId", event.seriesId).gt("startsAt", event.startsAt),
                )
                .first();
            seriesNextAt = next?.startsAt;
        }
    }

    // pending activation on conditional events
    let activation: { deadlineAt: number; threshold: number } | undefined;
    if (event.status === "conditional") {
        const pending = await ctx.db
            .query("eventActivations")
            .withIndex("by_eventId", (q: any) => q.eq("eventId", event._id))
            .filter((q: any) => q.eq(q.field("status"), "pending"))
            .first();
        if (pending !== null) {
            activation = { deadlineAt: pending.deadlineAt, threshold: pending.threshold };
        }
    }

    return {
        ...base,
        activation,
        attendedCount: attendances.length > 0 ? attendances.length : undefined,
        cadence,
        capacity: event.capacity,
        rsvpCount,
        seriesNextAt,
        seriesSlug,
        seriesTitle,
        speakers: speakers.length > 0 ? speakers : undefined,
    };
}

/** Describe a recurrence like "monthly" or "every 2 weeks". */
function cadenceText(recurrence: Doc<"recurrences">): string {
    const units: Record<string, string> = {
        daily: "day",
        weekly: "week",
        monthly: "month",
        yearly: "year",
    };

    // plain frequency for interval one
    if (recurrence.interval === 1) {
        return recurrence.frequency;
    }

    return `every ${recurrence.interval} ${units[recurrence.frequency]}s`;
}

async function memberRow(ctx: QueryCtx, member: Doc<"members">) {
    const handle = await handleFor(ctx, "member", member._id);
    const tags = await tagsFor(ctx, "member", member._id);

    return {
        bio: member.bio,
        handle: handle?.name ?? member._id,
        headline: member.headline,
        id: member._id,
        interests: tags,
        links: await linksFor(ctx, "member", member._id),
        name: member.name,
        status: member.status,
        visibility: member.visibility,
    };
}

export const calendar = query({
    args: {},
    handler: async (ctx) => {
        const entries = await ctx.db
            .query("calendarEntries")
            .withIndex("by_status_and_startsAt", (q: any) => q.eq("status", "published"))
            .collect();

        return await Promise.all(
            entries
                .sort((left, right) => left.startsAt - right.startsAt)
                .map((entry) => calendarRow(ctx, entry)),
        );
    },
});

export const event = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
            .first();

        if (event === null) {
            return null;
        }

        const [calendarEntry, venue, rsvpCount, agenda, speakers, series, tags] = await Promise.all(
            [
                ctx.db
                    .query("calendarEntries")
                    .withIndex("by_eventId", (q: any) => q.eq("eventId", event._id))
                    .first(),
                event.venueId === undefined ? null : ctx.db.get(event.venueId),
                ctx.db
                    .query("rsvps")
                    .withIndex("by_eventId", (q: any) => q.eq("eventId", event._id))
                    .filter((q) => q.neq(q.field("status"), "cancelled"))
                    .collect()
                    .then((rows) => rows.length),
                ctx.db
                    .query("eventAgendaItems")
                    .withIndex("by_eventId_and_position", (q: any) => q.eq("eventId", event._id))
                    .collect(),
                ctx.db
                    .query("eventSpeakers")
                    .withIndex("by_eventId_and_position", (q: any) => q.eq("eventId", event._id))
                    .collect(),
                event.seriesId === undefined ? null : ctx.db.get(event.seriesId),
                tagsFor(ctx, "event", event._id),
            ],
        );
        const address = venue === null ? null : await ctx.db.get(venue.addressId);

        return {
            agenda: agenda.map((item) => ({ time: item.time, title: item.title })),
            capacity: event.capacity,
            endsAt: event.endsAt,
            format: event.format,
            id: event._id,
            location: calendarEntry?.location,
            rsvpCount,
            seriesSlug: series?.slug,
            slug: event.slug,
            speakers: speakers.map((speaker) => ({
                name: speaker.name,
                title: speaker.title,
            })),
            startsAt: event.startsAt,
            status: event.status,
            summary: event.description,
            tags,
            timezone: calendarEntry?.timezone ?? "Europe/Zurich",
            title: event.title,
            venue: {
                access: venue?.accessNotes,
                address:
                    address === null
                        ? undefined
                        : [address.line1, address.postalCode, address.locality]
                              .filter(Boolean)
                              .join(", "),
                name: venue?.name ?? calendarEntry?.location,
            },
        };
    },
});

export const seriesList = query({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db
            .query("series")
            .withIndex("by_status", (q: any) => q.eq("status", "active"))
            .collect();

        return await Promise.all(
            rows.map(async (item) => ({
                cadence: item.recurrenceId === undefined ? "manual" : "recurring",
                id: item._id,
                ownerHandle: (await handleFor(ctx, "member", item.ownerMemberId))?.name,
                slug: item.slug,
                subscriberCount: (
                    await ctx.db
                        .query("seriesSubscriptions")
                        .withIndex("by_seriesId", (q: any) => q.eq("seriesId", item._id))
                        .filter((q: any) => q.eq(q.field("status"), "subscribed"))
                        .collect()
                ).length,
                summary: item.description,
                tags: await tagsFor(ctx, "series", item._id),
                title: item.title,
            })),
        );
    },
});

export const seriesDetail = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const item = await ctx.db
            .query("series")
            .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
            .first();

        if (item === null) {
            return null;
        }

        const events = await ctx.db
            .query("events")
            .withIndex("by_seriesId_and_startsAt", (q: any) => q.eq("seriesId", item._id))
            .collect();
        const entries = await Promise.all(
            events.map(async (event) => {
                const entry = await ctx.db
                    .query("calendarEntries")
                    .withIndex("by_eventId", (q: any) => q.eq("eventId", event._id))
                    .first();

                return entry === null ? null : calendarRow(ctx, entry);
            }),
        );

        return {
            cadence: item.recurrenceId === undefined ? "manual" : "recurring",
            entries: entries.filter((entry) => entry !== null),
            id: item._id,
            slug: item.slug,
            subscriberCount: (
                await ctx.db
                    .query("seriesSubscriptions")
                    .withIndex("by_seriesId", (q: any) => q.eq("seriesId", item._id))
                    .filter((q: any) => q.eq(q.field("status"), "subscribed"))
                    .collect()
            ).length,
            summary: item.description,
            tags: await tagsFor(ctx, "series", item._id),
            title: item.title,
        };
    },
});

export const membersList = query({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db
            .query("members")
            .withIndex("by_status", (q: any) => q.eq("status", "active"))
            .filter((q: any) => q.eq(q.field("visibility"), publicVisibility))
            .collect();

        return await Promise.all(rows.map((member) => memberRow(ctx, member)));
    },
});

export const member = query({
    args: { handle: v.string() },
    handler: async (ctx, args) => {
        const handle = await ctx.db
            .query("handles")
            .withIndex("by_name", (q: any) => q.eq("name", args.handle))
            .filter((q: any) => q.eq(q.field("subject"), "member"))
            .first();

        if (handle === null || handle.subject !== "member") {
            return null;
        }

        const member = await ctx.db.get(handle.subjectId as Id<"members">);
        if (member === null || member.visibility !== publicVisibility) {
            return null;
        }

        const events = await ctx.db
            .query("events")
            .withIndex("by_ownerMemberId", (q: any) => q.eq("ownerMemberId", member._id))
            .collect();
        const entries = await Promise.all(
            events.map(async (event) => {
                const entry = await ctx.db
                    .query("calendarEntries")
                    .withIndex("by_eventId", (q: any) => q.eq("eventId", event._id))
                    .first();

                return entry === null ? null : calendarRow(ctx, entry);
            }),
        );

        return {
            ...(await memberRow(ctx, member)),
            hostedEvents: entries.filter((entry) => entry !== null),
        };
    },
});

export const postsList = query({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db
            .query("posts")
            .withIndex("by_status_and_publishedAt", (q: any) => q.eq("status", "published"))
            .collect();

        return rows
            .sort((left, right) => (right.publishedAt ?? 0) - (left.publishedAt ?? 0))
            .map((post) => ({
                date: post.publishedAt,
                id: post._id,
                slug: post.slug,
                summary: post.summary,
                title: post.title,
            }));
    },
});

export const post = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const post = await ctx.db
            .query("posts")
            .withIndex("by_slug", (q: any) => q.eq("slug", args.slug))
            .first();

        if (post === null || post.status !== "published") {
            return null;
        }

        return {
            body: post.body,
            date: post.publishedAt,
            id: post._id,
            slug: post.slug,
            summary: post.summary,
            title: post.title,
        };
    },
});

export const handle = query({
    args: { handle: v.string() },
    handler: async (ctx, args) => {
        const handle = await ctx.db
            .query("handles")
            .withIndex("by_name", (q: any) => q.eq("name", args.handle))
            .filter((q: any) => q.eq(q.field("status"), "active"))
            .first();

        if (handle === null) {
            return null;
        }

        const member = await ctx.db.get(handle.subjectId as Id<"members">);
        return member === null
            ? null
            : {
                  href: `/members/${handle.name}`,
                  summary: member.headline,
                  title: member.name,
                  type: "member",
              };
    },
});

export const stats = query({
    args: {},
    handler: async (ctx) => {
        // count community totals over the live tables
        // NOTE #Performance: full scans, fine at community scale
        const members = await ctx.db.query("members").collect();
        const events = await ctx.db.query("events").collect();
        const series = await ctx.db.query("series").collect();
        const attendances = await ctx.db.query("attendances").collect();

        // keep only rows that represent the real community
        const liveMemberStatuses = ["active", "imported", "paused"];
        const liveEventStatuses = ["scheduled", "conditional", "finished"];
        const liveSeriesStatuses = ["active", "paused", "finished"];

        return {
            attendees: attendances.length,
            events: events.filter((event) => liveEventStatuses.includes(event.status)).length,
            members: members.filter((member) => liveMemberStatuses.includes(member.status)).length,
            series: series.filter((entry) => liveSeriesStatuses.includes(entry.status)).length,
        };
    },
});
