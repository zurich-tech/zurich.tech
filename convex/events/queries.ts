import { isListed } from "./visibility";
import { eventAttribution } from "./attribution";
import { eventPlace, disclosePlace } from "./place";
import { publicOrganiser, publicOrganisers, organiserIds } from "./organisers";
import { readLinks, publicLinks } from "../members/links";
import { photoUrls } from "./photos";
import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/** Read the complete published calendar. */
export const calendar = query({
    args: {},
    handler: async (ctx) => {
        const events = await ctx.db.query("events").collect();
        const series = await ctx.db.query("series").collect();
        const bySeries = new Map(series.map((item) => [item._id, item]));
        const credits = new Map(
            events.map((event) => [
                event._id,
                organiserIds(event, event.seriesId ? bySeries.get(event.seriesId) : undefined),
            ]),
        );
        const ids = [
            ...new Set([...credits.values()].flatMap((ids) => [ids.primary, ...ids.others])),
        ];
        const people = new Map(
            await Promise.all(ids.map(async (id) => [id, await publicOrganiser(ctx, id)] as const)),
        );

        return await Promise.all(
            events
                .filter(isListed)
                .sort((left, right) => left.startsAt - right.startsAt)
                .map((event) =>
                    calendarRow(
                        ctx,
                        event,
                        people.get(credits.get(event._id)!.primary) ?? null,
                        credits
                            .get(event._id)!
                            .others.map((id) => people.get(id))
                            .filter((person): person is NonNullable<typeof person> => !!person),
                        event.seriesId ? bySeries.get(event.seriesId) : null,
                    ),
                ),
        );
    },
});

/** Read one published event by slug. */
export const event = query({
    args: { slug: v.string() },
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
        const [place, rsvps, agenda, speakers, links, media] = await Promise.all([
            eventPlace(ctx, event),
            ctx.db
                .query("registrations")
                .withIndex("by_event", (query) => query.eq("eventId", event._id))
                .collect(),
            ctx.db
                .query("sessions")
                .withIndex("by_event_and_position", (query) => query.eq("eventId", event._id))
                .collect(),
            ctx.db
                .query("speakers")
                .withIndex("by_event_and_position", (query) => query.eq("eventId", event._id))
                .collect(),
            publicLinks(ctx, event._id),
            ctx.db
                .query("photos")
                .withIndex("by_event_and_position", (query) => query.eq("eventId", event._id))
                .filter((query) => query.eq(query.field("status"), "approved"))
                .collect(),
        ]);
        // resolve public image URLs in display order
        const images = await Promise.all(
            media
                .sort((left, right) => left.position - right.position)
                .map(async (image) => ({
                    id: image._id,
                    alt: image.alt ?? `Photo ${image.position + 1} from ${event.title}`,
                    caption: image.caption,
                    height: image.height,
                    ...(await photoUrls(ctx, image)),
                    width: image.width,
                })),
        );

        const series = event.seriesId ? await ctx.db.get(event.seriesId) : null;
        const credits = await publicOrganisers(ctx, event, series);
        const venue = event.venueId ? await ctx.db.get(event.venueId) : null;
        const disclosed = disclosePlace(place, event.addressAccess, false, venue?.accessNotes);

        return {
            id: event._id,
            visibility: event.visibility ?? "public",
            checkIn: event.checkIn,
            feedback: event.feedback,
            registration: publicRegistration(event.registration),
            isPartner: eventAttribution(event, series) === "external" || !!event.partnerIds?.length,
            isFull:
                event.registration.kind === "native" &&
                event.registration.capacity !== null &&
                rsvps.filter((row) => row.status === "going").length >= event.registration.capacity,
            isApproved: event.approvedAt !== undefined,
            seriesId: event.seriesId,
            series,
            ...credits,
            topics: event.topics,
            organisations: await Promise.all(
                (event.organisationIds ?? []).map(async (id) => {
                    const organisation = await ctx.db.get(id);
                    if (!organisation) throw new Error("Event organisation is missing.");

                    return { slug: organisation.slug, name: organisation.name };
                }),
            ),
            agenda: agenda.map((item) => ({
                time: item.time,
                title: item.title,
                speakerIds: item.speakerIds ?? [],
            })),

            description: event.description,
            endsAt: event.endsAt,
            format: event.format,
            links,
            location: [disclosed.name, disclosed.address].filter(Boolean).join(", "),
            media: images,
            rsvpCount: rsvps.filter((rsvp) => rsvp.status === "going").length,
            registrationCapacity:
                event.registration.kind === "native" ? event.registration.capacity : undefined,
            waitlistCount: rsvps.filter((rsvp) => rsvp.status === "waitlist").length,
            slug: event.slug,
            speakers: await Promise.all(
                speakers
                    .filter((speaker) => !speaker.isRemoved)
                    .map(async (speaker) => {
                        // reuse a consented public profile portrait unless this appearance overrides it
                        const member = speaker.memberId
                            ? await speakerProfile(ctx, speaker.memberId)
                            : undefined;
                        return {
                            profileUrl: member?.url,
                            name: speaker.name,
                            id: speaker._id,
                            affiliations: speaker.affiliations ?? member?.affiliations,
                            imageUrl: speaker.imageUrl ?? member?.imageUrl,
                            imageDarkUrl: speaker.imageUrl
                                ? speaker.imageDarkUrl
                                : member?.imageDarkUrl,
                            links: (await readLinks(ctx, speaker._id)).map((link) => link.url),
                        };
                    }),
            ),
            startsAt: event.startsAt,
            status: event.status,
            confirmation: event.confirmation,
            confirmedAt: event.confirmedAt,
            summary: event.summary,
            timezone: "Europe/Zurich",
            title: event.title,
            venue: disclosed,
        };
    },
});

/** Expand one published calendar entry with event records. */
export async function calendarRow(
    ctx: QueryCtx,
    event: Doc<"events">,
    organiser?: Awaited<ReturnType<typeof publicOrganiser>>,
    coOrganisers: NonNullable<Awaited<ReturnType<typeof publicOrganiser>>>[] = [],
    series?: Doc<"series"> | null,
) {
    // reuse the calendar's series lookup for both attribution and organiser credits
    if (series === undefined) series = event.seriesId ? await ctx.db.get(event.seriesId) : null;

    // reuse batch-resolved credits when available; expand isolated rows on demand
    const credits =
        organiser === undefined
            ? await publicOrganisers(ctx, event, series)
            : { organiser, coOrganisers };
    const rows = await ctx.db
        .query("registrations")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();
    const registrations = event.registration.kind === "native" || rows.length ? rows : undefined;

    return {
        ...credits,
        id: event._id,
        href: `/events/${event.slug}`,
        slug: event.slug,
        title: event.title,
        summary: event.summary,
        startsAt: event.startsAt,
        location: event.location,
        topics: event.topics,
        registrationKind: event.registration.kind,
        isPartner: eventAttribution(event, series) === "external" || !!event.partnerIds?.length,
        seriesId: event.seriesId,
        status: event.status,
        confirmation: event.confirmation,
        confirmedAt: event.confirmedAt,

        rsvpCount: registrations?.filter((row) => row.status === "going").length,
        waitlistCount: registrations?.filter((row) => row.status === "waitlist").length,
    };
}

/** Resolve public member profiles without exposing private membership records. */
async function speakerProfile(ctx: QueryCtx, memberId: Doc<"members">["_id"]) {
    const member = await ctx.db.get(memberId);
    if (
        !member ||
        member.visibility !== "public" ||
        member.status === "deleted" ||
        member.status === "blocked"
    )
        return undefined;
    const handle = await ctx.db
        .query("handles")
        .withIndex("by_member", (q) => q.eq("memberId", memberId))
        .collect();
    const active = handle.find((row) => row.status === "active");
    return active
        ? {
              url: `/members/${active.name}`,
              affiliations: member.affiliations,
              imageUrl: member.avatarUrl,
              imageDarkUrl: member.avatarDarkUrl,
          }
        : undefined;
}

/** Publish admission rules without disclosing internal booking limits. */
function publicRegistration(registration: Doc<"events">["registration"]) {
    if (registration.kind === "none") return registration;
    const { capacity, ...policy } = registration;
    return policy;
}
