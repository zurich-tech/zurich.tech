import { readLinks } from "../members/links";
import { mediaOrigin } from "./gallery";
import { eventTags } from "../search/search";
import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { publicLinks } from "../members/queries";

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
            id: event._id,
            checkIn: event.checkIn,
            feedback: event.feedback,
            registration: publicRegistration(event.registration),
            isPartner: !!event.partnerIds?.length,
            isFull:
                event.registration.kind === "native" &&
                event.registration.capacity !== null &&
                rsvps.filter((row) => row.status === "going").length >= event.registration.capacity,
            isApproved: event.approvedAt !== undefined,
            seriesId: event.seriesId,
            series: event.seriesId ? await ctx.db.get(event.seriesId) : null,
            topics: event.topics,
            organisations: await Promise.all(
                (event.organisationIds ?? []).map(async (id) => {
                    const organisation = await ctx.db.get(id);
                    if (!organisation) throw new Error("Event organisation is missing.");

                    return { slug: organisation.slug, name: organisation.name };
                }),
            ),
            agenda: agenda.map((item) => ({ time: item.time, title: item.title })),

            description: event.description,
            endsAt: event.endsAt,
            format: event.format,
            links,
            location: [event.location, event.address].filter(Boolean).join(", "),
            media: images,
            rsvpCount: rsvps.filter((rsvp) => rsvp.status === "going").length,
            waitlistCount: rsvps.filter((rsvp) => rsvp.status === "waitlist").length,
            slug: event.slug,
            speakers: await Promise.all(
                speakers
                    .filter((speaker) => !speaker.isRemoved)
                    .map(async (speaker) => ({
                        profileUrl: speaker.memberId
                            ? await speakerProfile(ctx, speaker.memberId)
                            : undefined,
                        name: speaker.name,
                        title: speaker.title,
                        imageUrl: speaker.imageUrl,
                        imageDarkUrl: speaker.imageDarkUrl,
                        links: (await readLinks(ctx, speaker._id)).map((link) => link.url),
                    })),
            ),
            startsAt: event.startsAt,
            status: event.status,
            confirmation: event.confirmation,
            confirmedAt: event.confirmedAt,
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
                    event.address ??
                    (address === null
                        ? undefined
                        : [address.line1, address.line2, address.postalCode, address.locality]
                              .filter(Boolean)
                              .join(", ")),
                name: venue?.name ?? event.location,
            },
        };
    },
});

/** Expand one published calendar entry with event records. */
export async function calendarRow(ctx: QueryCtx, event: Doc<"events">) {
    const rows = await ctx.db
        .query("registrations")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();
    const registrations = event.registration.kind === "native" || rows.length ? rows : undefined;

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
        isPartner: !!event.partnerIds?.length,
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
    return active ? `/members/${active.name}` : undefined;
}

/** Publish admission rules without disclosing internal booking limits. */
function publicRegistration(registration: Doc<"events">["registration"]) {
    if (registration.kind === "none") return registration;
    const { capacity, ...policy } = registration;
    return policy;
}
