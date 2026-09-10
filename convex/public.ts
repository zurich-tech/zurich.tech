import { socialProviders } from "./auth/providers";
import { articles } from "../shared/news.generated";
import { paidTerm } from "./payments";
import { activeSponsors } from "./sponsors";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";

/** Maximum event results in the command menu. */
const eventSearchLimit = 6;
/** Maximum search input length in characters. */
const maximumSearchLength = 200;
/** Public origin for approved event images. */
const mediaOrigin = "https://media.zurich.tech";
/** Visibility admitted by public directory queries. */
const publicVisibility = "public" as const;

/** Supported temporal event filters. */
type EventPeriod = "past" | "upcoming";

/** Search words with temporal filters removed. */
type EventQuery = {
    /** Empty or contradictory filters cannot match events. */
    isImpossible: boolean;
    /** Optional restriction relative to the requested instant. */
    period?: EventPeriod;
    /** Remaining words to match against event copy. */
    text: string;
};

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
        const [events, members, news] = await Promise.all([
            searchEvents(ctx, eventsQuery, args.now),
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
            Promise.resolve(
                isEventFilter
                    ? []
                    : articles
                          .filter((article) =>
                              `${article.title} ${article.description}`
                                  .toLowerCase()
                                  .includes(text.toLowerCase()),
                          )
                          .slice(0, 4),
            ),
        ]);

        // resolve member handles in result order
        const memberResults = await Promise.all(
            members.map(async (member) => {
                const handle = await memberHandle(ctx, member._id);
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
                href: `/events/${event.slug}`,
                kind: "event" as const,
                label: event.title,
            })),
            ...memberResults,
            ...news.map((article) => ({
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
        const events = await ctx.db.query("events").collect();

        return await Promise.all(
            events
                .filter((event) => event.status !== "draft")
                .sort((left, right) => left.startsAt - right.startsAt)
                .map((event) => calendarRow(ctx, event)),
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

        if (event.status === "draft") return null;

        // expand the published event records
        const [venue, rsvps, agenda, speakers, links, media] = await Promise.all([
            event.venueId === undefined ? null : ctx.db.get(event.venueId),
            ctx.db
                .query("rsvps")
                .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
                .collect(),
            ctx.db
                .query("eventAgendaItems")
                .withIndex("by_eventId_and_position", (query) => query.eq("eventId", event._id))
                .collect(),
            ctx.db
                .query("eventSpeakers")
                .withIndex("by_eventId_and_position", (query) => query.eq("eventId", event._id))
                .collect(),
            publicLinks(ctx, "event", event._id),
            ctx.db
                .query("media")
                .withIndex("by_eventId_and_position", (query) => query.eq("eventId", event._id))
                .filter((query) => query.eq(query.field("status"), "approved"))
                .collect(),
        ]);
        const address = venue === null ? null : await ctx.db.get(venue.addressId);
        if (event.venueId !== undefined && venue === null) {
            throw new Error(`Published event ${event._id} refers to a missing venue.`);
        }
        if (venue !== null && address === null) {
            throw new Error(`Venue ${venue._id} refers to a missing address.`);
        }
        // resolve public image URLs in display order
        const images = media
            .sort((left, right) => left.position - right.position)
            .map((image) => ({
                alt: image.alt ?? `Photo ${image.position + 1} from ${event.title}`,
                caption: image.caption,
                height: image.height,
                thumbnailUrl: `${mediaOrigin}/${image.thumbnailKey}`,
                url: `${mediaOrigin}/${image.key}`,
                width: image.width,
            }));

        const latitude = event.latitude ?? address?.latitude;
        const longitude = event.longitude ?? address?.longitude;

        return {
            registration: event.registration,
            seriesId: event.seriesId,
            organisations: await Promise.all(
                (event.organisationIds ?? []).map(async (id) => {
                    const organisation = await ctx.db.get(id);
                    if (!organisation) throw new Error("Event organisation is missing.");

                    return organisation;
                }),
            ),
            agenda: agenda.map((item) => ({ time: item.time, title: item.title })),
            capacity: event.registration.kind !== "none" ? event.registration.capacity : undefined,
            description: event.description,
            endsAt: event.endsAt,
            format: event.format,
            links,
            location: event.location,
            media: images,
            rsvpCount: rsvps.filter((rsvp) => rsvp.status === "going").length,
            waitlistCount: rsvps.filter((rsvp) => rsvp.status === "waitlist").length,
            slug: event.slug,
            speakers: speakers.map((speaker) => ({
                name: speaker.name,
                title: speaker.title,
                imageUrl: speaker.imageUrl,
                imageDarkUrl: speaker.imageDarkUrl,
                links: speaker.links ?? [],
            })),
            startsAt: event.startsAt,
            status: event.status,
            summary: event.summary,
            tags: eventTags(event.topics, event.startsAt, args.now),
            timezone: "Europe/Zurich",
            title: event.title,
            venue: {
                coordinates:
                    latitude !== undefined && longitude !== undefined
                        ? { latitude, longitude }
                        : undefined,
                access: venue?.accessNotes,
                address:
                    address === null
                        ? undefined
                        : [address.line1, address.line2, address.postalCode, address.locality]
                              .filter(Boolean)
                              .join(", "),
                name: venue?.name ?? event.location,
            },
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
            events
                .filter((event) => event.status !== "draft")
                .map((event) => calendarRow(ctx, event)),
        );

        // show patron recognition only with the member's consent
        const patron = await ctx.db
            .query("patrons")
            .withIndex("by_member", (q) => q.eq("memberId", member._id))
            .unique();

        const term = patron?.isPublic ? await paidTerm(ctx, member._id) : null;

        return {
            ...(await memberRow(ctx, member)),
            isPatron: term !== null && term.endsAt > Date.now(),
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

/** Read the public series and organisation directory. */
export const directory = query({
    args: {},
    handler: async (ctx) => {
        const sponsors = await activeSponsors(ctx);
        const sponsored = new Set(sponsors.map((sponsor) => sponsor.organisationId));
        const organisations = await ctx.db.query("organisations").collect();

        return {
            series: await ctx.db
                .query("series")
                .filter((q) => q.eq(q.field("status"), "active"))
                .collect(),
            organisations: await Promise.all(
                organisations.map(async (organisation) => ({
                    _id: organisation._id,
                    slug: organisation.slug,
                    name: organisation.name,
                    kind: organisation.kind,
                    description: organisation.description,
                    location: organisation.location,
                    website: organisation.website,
                    logoUrl: organisation.logoUrl,
                    logoDarkUrl: organisation.logoDarkUrl,
                    mapLogoUrl: organisation.mapLogoUrl,
                    mapLogoDarkUrl: organisation.mapLogoDarkUrl,
                    profileUrl: organisation.profileUrl,
                    socials: organisation.socials,
                    isSponsor: sponsored.has(organisation._id),
                    sponsorTier: sponsors.find(
                        (sponsor) => sponsor.organisationId === organisation._id,
                    )?.tier,
                    locations: await Promise.all(
                        (
                            await ctx.db
                                .query("organisationLocations")
                                .withIndex("by_organisation", (q) =>
                                    q.eq("organisationId", organisation._id),
                                )
                                .collect()
                        ).map(async (location) => ({
                            ...location,
                            address: await ctx.db.get(location.addressId),
                        })),
                    ),
                })),
            ),
        };
    },
});

/** Find the active handle for one member. */
async function memberHandle(ctx: QueryCtx, subjectId: Id<"members">) {
    return await ctx.db
        .query("handles")
        .withIndex("by_subject_and_subjectId", (query) =>
            query.eq("subject", "member").eq("subjectId", subjectId),
        )
        .filter((query) => query.eq(query.field("status"), "active"))
        .unique();
}

/** Read the public links attached to one record. */
async function publicLinks(
    ctx: QueryCtx,
    subject: "member" | "event",
    subjectId: Id<"members"> | Id<"events">,
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
async function memberTags(ctx: QueryCtx, subjectId: Id<"members">) {
    const taggings = await ctx.db
        .query("taggings")
        .withIndex("by_subject_and_subjectId", (query) =>
            query.eq("subject", "member").eq("subjectId", subjectId),
        )
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

/** Expand one published calendar entry with event records. */
async function calendarRow(ctx: QueryCtx, event: Doc<"events">) {
    const isLive =
        event.registration.kind === "native" &&
        event.status === "scheduled" &&
        event.startsAt > Date.now();
    const registrations = isLive
        ? await ctx.db
              .query("rsvps")
              .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
              .collect()
        : undefined;

    return {
        id: event._id,
        href: `/events/${event.slug}`,
        slug: event.slug,
        title: event.title,
        summary: event.summary,
        startsAt: event.startsAt,
        location: event.location,
        tags: event.topics,
        registrationKind: event.registration.kind,
        seriesId: event.seriesId,
        status: event.status,
        capacity: event.registration.kind === "none" ? undefined : event.registration.capacity,
        rsvpCount: registrations?.filter((row) => row.status === "going").length,
        waitlistCount: registrations?.filter((row) => row.status === "waitlist").length,
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
): Promise<Doc<"events">[]> {
    if (query.isImpossible) return [];
    const events = await ctx.db.query("events").collect();
    const terms = query.text.toLowerCase().split(/\s+/).filter(Boolean);

    // filter the small public catalogue without maintaining a second event index
    return events
        .filter((event) => {
            const text = [
                event.title,
                event.summary,
                event.description,
                event.location,
                ...event.topics,
            ]
                .join(" ")
                .toLowerCase();

            return (
                event.status !== "draft" &&
                terms.every((term) => text.includes(term)) &&
                (query.period === undefined ||
                    (event.startsAt >= now ? "upcoming" : "past") === query.period)
            );
        })
        .sort((left, right) =>
            query.period === "past"
                ? right.startsAt - left.startsAt
                : left.startsAt - right.startsAt,
        )
        .slice(0, eventSearchLimit);
}

/** Describe one event search result with its searchable tags. */
function eventSearchDescription(entry: Doc<"events">, now: number): string {
    const tags = eventTags(entry.topics, entry.startsAt, now).map((tag) => `#${tag}`);

    return [...tags, entry.summary].filter(Boolean).join(" ");
}

/** Expand one public member profile. */
async function memberRow(ctx: QueryCtx, member: Doc<"members">) {
    const handle = await memberHandle(ctx, member._id);
    if (handle === null) {
        throw new Error(`Public member ${member._id} has no active handle.`);
    }
    const tags = await memberTags(ctx, member._id);

    return {
        bio: member.bio,
        handle: handle.name,
        headline: member.headline,
        interests: tags,
        links: await publicLinks(ctx, "member", member._id),
        name: member.name,
        status: member.status,
        visibility: member.visibility,
    };
}

/** Read a balanced selection of approved photos from the three latest photographed events. */
export const gallery = query({
    args: { now: v.number() },
    handler: async (ctx, args) => {
        // consider only finished events, most recent first
        const events = await ctx.db
            .query("events")
            .withIndex("by_status_and_startsAt", (range) =>
                range.eq("status", "finished").lt("startsAt", args.now),
            )
            .order("desc")
            .collect();
        const albums = [];

        // group up to five photographs under each event destination
        for (const event of events) {
            const images = await ctx.db
                .query("media")
                .withIndex("by_eventId_and_position", (range) => range.eq("eventId", event._id))
                .filter((range) => range.eq(range.field("status"), "approved"))
                .take(5);
            if (images.length > 0) {
                albums.push({
                    title: event.title,
                    href: `/events/${event.slug}#photos`,
                    images: images.map((image) => ({
                        id: image._id,
                        alt: image.alt ?? `Photo from ${event.title}`,
                        width: image.width,
                        height: image.height,
                        thumbnailUrl: `${mediaOrigin}/${image.thumbnailKey}`,
                    })),
                });
            }
            if (albums.length === 3) break;
        }

        return albums;
    },
});

/** Public geographic locations with recognition derived from current sponsorships. */
export const map = query({
    args: {},
    handler: async (ctx) => {
        const sponsors = await activeSponsors(ctx);
        const locations = await ctx.db.query("organisationLocations").collect();
        const markers = await Promise.all(
            locations.map(async (location) => {
                const sponsor = sponsors.find(
                    (item) => item.organisationId === location.organisationId,
                );
                if (!sponsor && !location.isCurated) return null;
                const organisation = await ctx.db.get(location.organisationId);
                const address = await ctx.db.get(location.addressId);
                if (
                    !organisation ||
                    address?.latitude === undefined ||
                    address.longitude === undefined
                )
                    return null;
                return {
                    id: location._id,
                    name: organisation.name,
                    location: location.name,
                    slug: organisation.slug,
                    logoUrl: organisation.logoUrl,
                    logoDarkUrl: organisation.logoDarkUrl,
                    mapLogoUrl: organisation.mapLogoUrl,
                    mapLogoDarkUrl: organisation.mapLogoDarkUrl,
                    latitude: address.latitude,
                    longitude: address.longitude,
                    tier: sponsor?.tier,
                };
            }),
        );
        return markers.filter((marker) => marker !== null);
    },
});

/** Expose enabled sign-in names without returning their credentials. */
export const signInProviders = query({
    args: {},
    handler: () => Object.keys(socialProviders()),
});
