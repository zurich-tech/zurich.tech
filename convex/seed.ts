import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { archiveEvents, type ArchiveEvent, validateArchive } from "./archive";
import { normalizeEmail } from "./email";
import { searchText } from "./search";
import { setTags } from "./tag";

/** Populate the Zurich AI archive records. */
export const run = internalMutation({
    args: {},
    handler: async (ctx) => {
        // validate the checked archive before writing any records
        validateArchive();

        // members
        const staff = await ensureMember(ctx, {
            bio: "Runs zurich.tech.",
            email: "hello@zurich.tech",
            handle: "staff",
            headline: "zurich.tech",
            name: "zurich.tech",
        });
        const zurichAi = await ensureMember(ctx, {
            bio: "ZurichNLP, ZurichCV, and ZurichRobotics.",
            email: "hello@zurichai.ch",
            handle: "zurichai",
            headline: "Machine learning events in Zurich.",
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
                accessNotes: "OAT building.",
                address: {
                    countryCode: "CH",
                    line1: "Andreasstrasse 5",
                    line2: "OAT, 14th floor",
                    locality: "Zürich",
                    postalCode: "8050",
                },
                name: "ETH AI Center",
            }),
            "eth-ai-center-19": await ensureVenue(ctx, {
                accessNotes: "OAT building.",
                address: {
                    countryCode: "CH",
                    line1: "Andreasstrasse 5",
                    line2: "OAT, 19th floor",
                    locality: "Zürich",
                    postalCode: "8050",
                },
                name: "ETH AI Center",
            }),
            "eth-zurich-bin13": await ensureVenue(ctx, {
                accessNotes: "4th floor.",
                address: {
                    countryCode: "CH",
                    line1: "Binzmühlestrasse 13",
                    line2: "4th floor",
                    locality: "Zürich",
                    postalCode: "8050",
                },
                name: "ETH Zurich, Binzmühlestrasse 13",
            }),
        } satisfies Record<ArchiveEvent["venue"], Id<"venues">>;

        // events
        for (const item of archiveEvents) {
            const location = "Zürich";
            const eventId = await ensureEvent(ctx, {
                description: item.description,
                endsAt: Date.parse(item.endsAt),
                format: "talk",
                location,
                ownerMemberId: zurichAi,
                slug: item.slug,
                source: "event",
                sourceUrl: item.sourceUrl,
                speakers: item.speakers,
                startsAt: Date.parse(item.startsAt),
                status: "finished",
                summary: item.summary,
                tags: item.tags,
                title: item.title,
                venueId: venueIds[item.venue],
            });

            await ensureSpeakers(ctx, eventId, item.speakers);
            await ensureLink(
                ctx,
                "event",
                eventId,
                "website",
                `original listing on ${item.source}`,
                item.sourceUrl,
                0,
            );
            await setTags(ctx, "event", eventId, item.tags);
        }

        // member tags
        await setTags(ctx, "member", zurichAi, ["machine-learning", "events"]);
        await setTags(ctx, "member", staff, ["events", "operations"]);

        return { events: archiveEvents.length, ok: true };
    },
});

/** Create or update one seeded member. */
async function ensureMember(
    ctx: MutationCtx,
    args: { bio: string; email: string; handle: string; headline: string; name: string },
) {
    const now = Date.now();
    const existingHandle = await ctx.db
        .query("handles")
        .withIndex("by_name", (query) => query.eq("name", args.handle))
        .unique();

    if (existingHandle !== null) {
        await ctx.db.patch(existingHandle.subjectId as Id<"members">, {
            bio: args.bio,
            headline: args.headline,
            name: args.name,
            searchText: searchText(args.name, args.handle, args.headline, args.bio),
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
        searchText: searchText(args.name, args.handle, args.headline, args.bio),
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
        email: normalizeEmail(args.email),
        isPrimary: true,
        memberId,
        source: "seed",
        updatedAt: now,
        verifiedAt: now,
    });

    return memberId;
}

/** Create or update one seeded link. */
async function ensureLink(
    ctx: MutationCtx,
    subject: "member" | "event",
    subjectId: Id<"members"> | Id<"events">,
    kind: "website" | "github" | "linkedin" | "x" | "mastodon" | "youtube" | "newsletter" | "other",
    label: string,
    url: string,
    position: number,
) {
    const existing = (
        await ctx.db
            .query("links")
            .withIndex("by_subject_and_subjectId", (query) =>
                query.eq("subject", subject).eq("subjectId", subjectId),
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

/** Create or update one seeded venue and address. */
async function ensureVenue(
    ctx: MutationCtx,
    args: {
        accessNotes?: string;
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
    const addresses = await ctx.db
        .query("addresses")
        .withIndex("by_countryCode_and_locality", (query) =>
            query.eq("countryCode", args.address.countryCode).eq("locality", args.address.locality),
        )
        .collect();
    const matchingAddresses = addresses.filter(
        (address) =>
            address.line1 === args.address.line1 &&
            address.line2 === args.address.line2 &&
            address.postalCode === args.address.postalCode,
    );

    // reject ambiguous address identity
    if (matchingAddresses.length > 1) {
        throw new Error(`Multiple seeded addresses match ${args.address.line1}.`);
    }

    // create or update the structured address
    const address = matchingAddresses[0];
    const addressId =
        address?._id ??
        (await ctx.db.insert("addresses", {
            ...args.address,
            createdAt: now,
            updatedAt: now,
        }));
    if (address !== undefined) {
        await ctx.db.patch(addressId, { ...args.address, updatedAt: now });
    }

    // update the venue at this exact address
    const existing = await ctx.db
        .query("venues")
        .withIndex("by_addressId", (query) => query.eq("addressId", addressId))
        .unique();
    if (existing !== null) {
        await ctx.db.patch(existing._id, {
            accessNotes: args.accessNotes,
            name: args.name,
            status: "active",
            updatedAt: now,
        });

        return existing._id;
    }

    // create the venue at this exact address
    return await ctx.db.insert("venues", {
        accessNotes: args.accessNotes,
        addressId,
        createdAt: now,
        name: args.name,
        status: "active",
        updatedAt: now,
    });
}

/** Create or update one seeded event and calendar entry. */
async function ensureEvent(
    ctx: MutationCtx,
    args: {
        capacity?: number;
        description: string;
        endsAt: number;
        format: "meetup" | "talk" | "workshop" | "hackathon" | "office_hours" | "other";
        location: string;
        ownerMemberId: Id<"members">;
        slug: string;
        source: "event" | "manual" | "external";
        sourceUrl: string;
        speakers: Array<{ name: string; title?: string }>;
        startsAt: number;
        status?: "scheduled" | "conditional" | "finished";
        summary: string;
        tags: string[];
        title: string;
        venueId: Id<"venues">;
    },
) {
    const now = Date.now();
    const status = args.status ?? "scheduled";
    const slugEvent = await ctx.db
        .query("events")
        .withIndex("by_slug", (query) => query.eq("slug", args.slug))
        .unique();
    const sourceLink = await ctx.db
        .query("links")
        .withIndex("by_url", (query) => query.eq("url", args.sourceUrl))
        .filter((query) => query.eq(query.field("subject"), "event"))
        .unique();
    const sourceEvent =
        sourceLink === null ? null : await ctx.db.get(sourceLink.subjectId as Id<"events">);

    // reject conflicting canonical and source identities
    if (sourceLink !== null && sourceEvent === null) {
        throw new Error(`Source link ${sourceLink._id} refers to a missing event.`);
    }
    if (slugEvent !== null && sourceEvent !== null && slugEvent._id !== sourceEvent._id) {
        throw new Error(`Archive event ${args.slug} resolves to two existing events.`);
    }

    // update the source event when its canonical slug changed
    const existing = slugEvent ?? sourceEvent;
    const eventId =
        existing?._id ??
        (await ctx.db.insert("events", {
            capacity: args.capacity,
            createdAt: now,
            description: args.description,
            endsAt: args.endsAt,
            format: args.format,
            location: args.location,
            ownerMemberId: args.ownerMemberId,
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
            location: args.location,
            ownerMemberId: args.ownerMemberId,
            slug: args.slug,
            startsAt: args.startsAt,
            status,
            title: args.title,
            updatedAt: now,
            venueId: args.venueId,
        });
    }

    const eventEntry = await ctx.db
        .query("calendarEntries")
        .withIndex("by_eventId", (query) => query.eq("eventId", eventId))
        .unique();
    const slugEntry = await ctx.db
        .query("calendarEntries")
        .withIndex("by_slug", (query) => query.eq("slug", args.slug))
        .unique();

    // reject conflicting event and route identities
    if (eventEntry !== null && slugEntry !== null && eventEntry._id !== slugEntry._id) {
        throw new Error(`Archive event ${args.slug} resolves to two calendar entries.`);
    }
    if (slugEntry?.eventId !== undefined && slugEntry.eventId !== eventId) {
        throw new Error(`Archive route ${args.slug} belongs to another event.`);
    }

    const entry = eventEntry ?? slugEntry;
    const calendarFields = {
        endsAt: args.endsAt,
        eventId,
        href: `/events/${args.slug}`,
        location: args.location,
        tags: uniqueTags(...args.tags),
        searchText: searchText(
            args.title,
            args.summary,
            args.description,
            args.location,
            ...args.tags,
            ...args.speakers.flatMap((speaker) => [speaker.name, speaker.title]),
        ),
        slug: args.slug,
        source: args.source,
        startsAt: args.startsAt,
        status: "published" as const,
        summary: args.summary,
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

/** Return unique defined tags in their display order. */
function uniqueTags(...tags: Array<string | undefined>): string[] {
    return [...new Set(tags.filter((tag): tag is string => tag !== undefined))];
}

/** Replace one event's ordered speakers. */
async function ensureSpeakers(
    ctx: MutationCtx,
    eventId: Id<"events">,
    speakers: Array<{ name: string; title?: string }>,
) {
    const now = Date.now();
    const existing = await ctx.db
        .query("eventSpeakers")
        .withIndex("by_eventId", (query) => query.eq("eventId", eventId))
        .collect();
    const positioned = new Map(existing.map((speaker) => [speaker.position, speaker]));

    // update or insert speakers in published order
    for (const [position, speaker] of speakers.entries()) {
        const current = positioned.get(position);

        // create the missing position
        if (current === undefined) {
            await ctx.db.insert("eventSpeakers", {
                ...speaker,
                createdAt: now,
                eventId,
                position,
                updatedAt: now,
            });
        }
        // otherwise update the existing position
        else {
            await ctx.db.patch(current._id, {
                name: speaker.name,
                title: speaker.title,
                updatedAt: now,
            });
            positioned.delete(position);
        }
    }

    // remove positions absent from the archive
    for (const speaker of positioned.values()) {
        await ctx.db.delete(speaker._id);
    }
}
