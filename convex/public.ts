import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";

const eventSearchCandidateLimit = 64;
const eventSearchLimit = 6;
const maximumSearchLength = 200;
const publicVisibility = "public" as const;
const publicSeriesStatuses = ["active", "paused", "finished"] as const;

type EventPeriod = "past" | "upcoming";

type EventQuery = {
    isImpossible: boolean;
    period?: EventPeriod;
    text: string;
};

/** Find the active handle for one member. */
async function handleFor(ctx: QueryCtx, subjectId: Id<"members">) {
    return await ctx.db
        .query("handles")
        .withIndex("by_subject_and_subjectId", (query) =>
            query.eq("subject", "member").eq("subjectId", subjectId),
        )
        .filter((query) => query.eq(query.field("status"), "active"))
        .unique();
}

/** Read the public links attached to one record. */
async function linksFor(
    ctx: QueryCtx,
    subject: "member" | "event" | "series",
    subjectId: Id<"members"> | Id<"events"> | Id<"series">,
) {
    const links = await ctx.db
        .query("links")
        .withIndex("by_subject_and_subjectId", (query) =>
            query.eq("subject", subject).eq("subjectId", subjectId),
        )
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
async function tagsFor(
    ctx: QueryCtx,
    subject: "article" | "event" | "member" | "series",
    subjectId: Id<"articles"> | Id<"events"> | Id<"members"> | Id<"series">,
) {
    const taggings = await ctx.db
        .query("taggings")
        .withIndex("by_subject_and_subjectId", (query) =>
            query.eq("subject", subject).eq("subjectId", subjectId),
        )
        .collect();
    const tags = await Promise.all(taggings.map((tagging) => ctx.db.get(tagging.tagId)));

    return tags
        .map((tag) => {
            // reject broken tagging references
            if (tag === null) {
                throw new Error(`A ${subject} tagging refers to a missing tag.`);
            }

            return tag.slug;
        })
        .sort();
}

/** Expand one published calendar entry with event records. */
async function calendarRow(ctx: QueryCtx, entry: Doc<"calendarEntries">) {
    const base = {
        activation: undefined as { deadlineAt: number; threshold: number } | undefined,
        attendedCount: undefined as number | undefined,
        cadence: undefined as string | undefined,
        capacity: undefined as number | undefined,
        href: entry.href ?? `/events/${entry.slug}`,
        id: entry._id,
        location: entry.location,
        rsvpCount: undefined as number | undefined,
        seriesNextAt: undefined as number | undefined,
        seriesTitle: undefined as string | undefined,
        slug: entry.slug,
        speakers: undefined as string[] | undefined,
        startsAt: entry.startsAt,
        summary: entry.summary,
        tags: [...new Set(entry.tags)],
        title: entry.title,
    };

    // manual and external entries carry no product data
    if (entry.eventId === undefined) {
        return base;
    }
    const event = await ctx.db.get(entry.eventId);
    if (event === null) {
        throw new Error(`Calendar entry ${entry._id} refers to a missing event.`);
    }

    // rsvp gauge
    const rsvps = await ctx.db
        .query("rsvps")
        .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
        .collect();
    const rsvpCount = rsvps.filter((rsvp) => rsvp.status === "going").length;

    // attendance for finished events
    const attendances =
        event.status === "finished"
            ? await ctx.db
                  .query("attendances")
                  .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
                  .collect()
            : [];

    // speakers in position order
    const speakerRows = await ctx.db
        .query("eventSpeakers")
        .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
        .collect();
    const speakers = speakerRows
        .sort((left, right) => left.position - right.position)
        .map((speaker) => speaker.name);

    // series membership, cadence, and the next occurrence
    let seriesTitle: string | undefined;
    let cadence: string | undefined;
    let seriesNextAt: number | undefined;
    if (event.seriesId !== undefined) {
        const series = await ctx.db.get(event.seriesId);
        if (series === null) {
            throw new Error(`Event ${event._id} refers to a missing series.`);
        }
        if (!isPublicSeriesStatus(series.status)) {
            throw new Error(`Published event ${event._id} refers to a private series.`);
        }

        // resolve the series label and recurrence
        seriesTitle = series.title;
        if (series.recurrenceId !== undefined) {
            const recurrence = await ctx.db.get(series.recurrenceId);
            if (recurrence === null) {
                throw new Error(`Series ${series._id} refers to a missing recurrence.`);
            }
            cadence = cadenceText(recurrence);
        }

        // find the next scheduled occurrence
        const following = await ctx.db
            .query("events")
            .withIndex("by_seriesId_and_startsAt", (query) =>
                query.eq("seriesId", event.seriesId).gt("startsAt", event.startsAt),
            )
            .take(10);
        for (const candidate of following) {
            const entry = await ctx.db
                .query("calendarEntries")
                .withIndex("by_eventId", (query) => query.eq("eventId", candidate._id))
                .unique();

            // accept the first published occurrence
            if (entry?.status === "published") {
                seriesNextAt = entry.startsAt;
                break;
            }
        }
    }

    // pending activation on conditional events
    let activation: { deadlineAt: number; threshold: number } | undefined;
    if (event.status === "conditional") {
        const pending = await ctx.db
            .query("eventActivations")
            .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
            .filter((query) => query.eq(query.field("status"), "pending"))
            .unique();
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
        rsvpCount: event.status === "finished" ? undefined : rsvpCount,
        seriesNextAt,
        seriesTitle,
        speakers: speakers.length > 0 ? speakers : undefined,
    };
}

/** Add the requested period to stable event tags. */
function eventTags(tags: Array<string | undefined>, startsAt: number, now: number): string[] {
    const period = startsAt >= now ? "upcoming" : "past";
    const defined = tags.filter((tag): tag is string => tag !== undefined);

    return [...new Set([period, ...defined])];
}

/** Parse temporal event tags out of free-form search text. */
function eventQuery(text: string): EventQuery {
    const terms = [
        ...new Set(
            text
                .toLowerCase()
                .split(/\s+/)
                .map((term) => term.replace(/^#+/, ""))
                .filter(Boolean),
        ),
    ];
    const isUpcoming = terms.includes("upcoming");
    const isPast = terms.includes("past");
    const indexed = terms.filter((term) => term !== "upcoming" && term !== "past");
    let period: EventPeriod | undefined;

    // upcoming filter
    if (isUpcoming) {
        period = "upcoming";
    }
    // past filter
    else if (isPast) {
        period = "past";
    }

    return {
        isImpossible: (isUpcoming && isPast) || terms.length === 0,
        period,
        text: indexed.join(" "),
    };
}

/** Search public calendar entries with optional temporal filtering. */
async function searchEvents(
    ctx: QueryCtx,
    query: EventQuery,
    now: number,
): Promise<Doc<"calendarEntries">[]> {
    // reject mutually exclusive temporal tags
    if (query.isImpossible) {
        return [];
    }

    // use the chronological index when period is the entire query
    if (query.period !== undefined && query.text === "") {
        const entries = ctx.db
            .query("calendarEntries")
            .withIndex("by_status_and_startsAt", (range) => {
                // upcoming range
                if (query.period === "upcoming") {
                    return range.eq("status", "published").gte("startsAt", now);
                }
                // past range
                else {
                    return range.eq("status", "published").lt("startsAt", now);
                }
            })
            .order(query.period === "upcoming" ? "asc" : "desc");

        return await entries.take(eventSearchLimit);
    }

    // search stable fields and tags before applying the dynamic period
    const candidates = await ctx.db
        .query("calendarEntries")
        .withSearchIndex("search_text", (filter) =>
            filter.search("searchText", query.text).eq("status", "published"),
        )
        .take(query.period === undefined ? eventSearchLimit : eventSearchCandidateLimit);
    const matching = candidates.filter((entry) => {
        return (
            query.period === undefined ||
            eventTags(entry.tags, entry.startsAt, now)[0] === query.period
        );
    });

    return matching.slice(0, eventSearchLimit);
}

/** Describe one event search result with its searchable tags. */
function eventSearchDescription(entry: Doc<"calendarEntries">, now: number): string {
    const tags = eventTags(entry.tags, entry.startsAt, now).map((tag) => `#${tag}`);

    return [...tags, entry.summary].filter(Boolean).join(" ");
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

/** Expand one public member profile. */
async function memberRow(ctx: QueryCtx, member: Doc<"members">) {
    const handle = await handleFor(ctx, member._id);
    if (handle === null) {
        throw new Error(`Public member ${member._id} has no active handle.`);
    }
    const tags = await tagsFor(ctx, "member", member._id);

    return {
        bio: member.bio,
        handle: handle.name,
        headline: member.headline,
        interests: tags,
        links: await linksFor(ctx, "member", member._id),
        name: member.name,
        status: member.status,
        visibility: member.visibility,
    };
}

/** Search published public records. */
export const search = query({
    args: { now: v.number(), text: v.string() },
    handler: async (ctx, args) => {
        const text = args.text.trim();

        // reject empty and oversized searches
        if (text.length < 2) {
            return [];
        }
        if (text.length > maximumSearchLength) {
            throw new Error(`Search must be at most ${maximumSearchLength} characters.`);
        }

        const eventsQuery = eventQuery(text);
        const isEventFilter = eventsQuery.period !== undefined || eventsQuery.isImpossible;

        // search each public noun independently
        const [events, series, members, articles] = await Promise.all([
            searchEvents(ctx, eventsQuery, args.now),
            isEventFilter
                ? Promise.resolve([])
                : ctx.db
                      .query("series")
                      .withSearchIndex("search_text", (query) =>
                          query.search("searchText", text).eq("status", "active"),
                      )
                      .take(4),
            isEventFilter
                ? Promise.resolve([])
                : ctx.db
                      .query("members")
                      .withSearchIndex("search_text", (query) =>
                          query
                              .search("searchText", text)
                              .eq("status", "active")
                              .eq("visibility", "public"),
                      )
                      .take(6),
            isEventFilter
                ? Promise.resolve([])
                : ctx.db
                      .query("articles")
                      .withSearchIndex("search_text", (query) =>
                          query.search("searchText", text).eq("status", "published"),
                      )
                      .take(4),
        ]);

        // resolve member handles in result order
        const memberResults = await Promise.all(
            members.map(async (member) => {
                const handle = await handleFor(ctx, member._id);
                if (handle === null) {
                    throw new Error(`Public member ${member._id} has no active handle.`);
                }

                return {
                    description: member.headline,
                    href: `/members/${handle.name}`,
                    kind: "member" as const,
                    label: member.name,
                };
            }),
        );

        return [
            ...events.map((event) => ({
                description: eventSearchDescription(event, args.now),
                href: event.href ?? `/events/${event.slug}`,
                kind: "event" as const,
                label: event.title,
            })),
            ...series.map((item) => ({
                description: item.description,
                href: `/series/${item.slug}`,
                kind: "series" as const,
                label: item.title,
            })),
            ...memberResults,
            ...articles.map((article) => ({
                description: article.description,
                href: `/news/${article.slug}`,
                kind: "article" as const,
                label: article.title,
            })),
        ];
    },
});

/** Read the complete published calendar. */
export const calendar = query({
    args: {},
    handler: async (ctx) => {
        const entries = await ctx.db
            .query("calendarEntries")
            .withIndex("by_status_and_startsAt", (query) => query.eq("status", "published"))
            .collect();

        return await Promise.all(
            entries
                .sort((left, right) => left.startsAt - right.startsAt)
                .map((entry) => calendarRow(ctx, entry)),
        );
    },
});

/** Read one published event by slug. */
export const event = query({
    args: { now: v.number(), slug: v.string() },
    handler: async (ctx, args) => {
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (query) => query.eq("slug", args.slug))
            .unique();

        if (event === null) {
            return null;
        }

        const calendarEntry = await ctx.db
            .query("calendarEntries")
            .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
            .unique();
        if (calendarEntry === null || calendarEntry.status !== "published") {
            return null;
        }

        // expand the published event records
        const [venue, rsvpCount, agenda, speakers, series, tags, links] = await Promise.all([
            event.venueId === undefined ? null : ctx.db.get(event.venueId),
            ctx.db
                .query("rsvps")
                .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
                .filter((query) => query.eq(query.field("status"), "going"))
                .collect()
                .then((rows) => rows.length),
            ctx.db
                .query("eventAgendaItems")
                .withIndex("by_eventId_and_position", (query) => query.eq("eventId", event._id))
                .collect(),
            ctx.db
                .query("eventSpeakers")
                .withIndex("by_eventId_and_position", (query) => query.eq("eventId", event._id))
                .collect(),
            event.seriesId === undefined ? null : ctx.db.get(event.seriesId),
            tagsFor(ctx, "event", event._id),
            linksFor(ctx, "event", event._id),
        ]);
        const address = venue === null ? null : await ctx.db.get(venue.addressId);
        if (event.venueId !== undefined && venue === null) {
            throw new Error(`Published event ${event._id} refers to a missing venue.`);
        }
        if (venue !== null && address === null) {
            throw new Error(`Venue ${venue._id} refers to a missing address.`);
        }
        if (series !== null && !isPublicSeriesStatus(series.status)) {
            throw new Error(`Published event ${event._id} refers to a private series.`);
        }

        return {
            agenda: agenda.map((item) => ({ time: item.time, title: item.title })),
            capacity: event.capacity,
            endsAt: event.endsAt,
            format: event.format,
            links,
            location: calendarEntry.location,
            number: event.number,
            rsvpCount,
            seriesSlug: series?.slug,
            slug: event.slug,
            speakers: speakers.map((speaker) => ({
                name: speaker.name,
                title: speaker.title,
            })),
            startsAt: calendarEntry.startsAt,
            status: event.status,
            summary: event.description,
            tags: eventTags([series?.slug, ...tags], event.startsAt, args.now),
            timezone: calendarEntry.timezone,
            title: event.title,
            venue: {
                access: venue?.accessNotes,
                address:
                    address === null
                        ? undefined
                        : [address.line1, address.line2, address.postalCode, address.locality]
                              .filter(Boolean)
                              .join(", "),
                name: venue?.name ?? event.location ?? calendarEntry.location,
            },
        };
    },
});

/** Read one public event series by slug. */
export const seriesDetail = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const item = await ctx.db
            .query("series")
            .withIndex("by_slug", (query) => query.eq("slug", args.slug))
            .unique();

        if (item === null || !isPublicSeriesStatus(item.status)) {
            return null;
        }

        const events = await ctx.db
            .query("events")
            .withIndex("by_seriesId_and_startsAt", (query) => query.eq("seriesId", item._id))
            .collect();
        const entries = await Promise.all(
            events.map(async (event) => {
                const entry = await ctx.db
                    .query("calendarEntries")
                    .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
                    .unique();

                return entry?.status === "published" ? calendarRow(ctx, entry) : null;
            }),
        );

        // resolve the owner only when their profile is public
        const ownerMember = await ctx.db.get(item.ownerMemberId);
        if (ownerMember === null) {
            throw new Error(`Series ${item._id} refers to a missing owner.`);
        }
        const owner =
            ownerMember.status === "active" && ownerMember.visibility === publicVisibility
                ? await handleFor(ctx, ownerMember._id)
                : null;

        return {
            cadence: item.recurrenceId === undefined ? "no fixed schedule" : "recurring",
            entries: entries.filter((entry) => entry !== null),
            ownerHandle: owner?.name,
            slug: item.slug,
            subscriberCount: (
                await ctx.db
                    .query("seriesSubscriptions")
                    .withIndex("by_seriesId", (query) => query.eq("seriesId", item._id))
                    .filter((query) => query.eq(query.field("status"), "subscribed"))
                    .collect()
            ).length,
            summary: item.description,
            tags: await tagsFor(ctx, "series", item._id),
            title: item.title,
        };
    },
});

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
            .filter((query) => query.eq(query.field("subject"), "member"))
            .unique();

        if (handle === null || handle.status !== "active") {
            return null;
        }

        const member = await ctx.db.get(handle.subjectId);
        if (
            member === null ||
            member.status !== "active" ||
            member.visibility !== publicVisibility
        ) {
            return null;
        }

        const events = await ctx.db
            .query("events")
            .withIndex("by_ownerMemberId", (query) => query.eq("ownerMemberId", member._id))
            .collect();
        const entries = await Promise.all(
            events.map(async (event) => {
                const entry = await ctx.db
                    .query("calendarEntries")
                    .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
                    .unique();

                return entry?.status === "published" ? calendarRow(ctx, entry) : null;
            }),
        );

        return {
            ...(await memberRow(ctx, member)),
            hostedEvents: entries.filter((entry) => entry !== null),
        };
    },
});

/** Read published news articles in reverse chronology. */
export const articles = query({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db
            .query("articles")
            .withIndex("by_status_and_publishedAt", (query) => query.eq("status", "published"))
            .collect();

        const articles = rows.sort(
            (left, right) => (right.publishedAt ?? 0) - (left.publishedAt ?? 0),
        );

        return await Promise.all(
            articles.map(async (article) => ({
                date: article.publishedAt,
                description: article.description,
                slug: article.slug,
                tags: await tagsFor(ctx, "article", article._id),
                title: article.title,
            })),
        );
    },
});

/** Read one published news article by slug. */
export const article = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const article = await ctx.db
            .query("articles")
            .withIndex("by_slug", (query) => query.eq("slug", args.slug))
            .unique();

        if (article === null || article.status !== "published") {
            return null;
        }

        return {
            body: article.body,
            date: article.publishedAt,
            description: article.description,
            slug: article.slug,
            tags: await tagsFor(ctx, "article", article._id),
            title: article.title,
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

        const member = await ctx.db.get(handle.subjectId);
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

/** Return whether one series status is publicly visible. */
function isPublicSeriesStatus(status: Doc<"series">["status"]): boolean {
    return publicSeriesStatuses.some((publicStatus) => publicStatus === status);
}
