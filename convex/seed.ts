import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { archiveEvents, archiveSeries, type ArchiveEvent, validateArchive } from "./archive";
import { normalizeEmail } from "./email";
import { searchText } from "./search";

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

        // series
        const seriesIds = {} as Record<NonNullable<ArchiveEvent["series"]>, Id<"series">>;
        for (const item of archiveSeries) {
            const seriesId = await ensureSeries(ctx, {
                description: item.description,
                ownerMemberId: zurichAi,
                slug: item.slug,
                title: item.title,
            });
            seriesIds[item.slug] = seriesId;

            await setTags(ctx, "series", seriesId, item.tags);
        }

        // events
        for (const item of archiveEvents) {
            const seriesId = item.series === undefined ? undefined : seriesIds[item.series];
            const location = item.venue === "eth-zurich-bin13" ? "ETH Zurich" : "ETH AI Center";
            const eventId = await ensureEvent(ctx, {
                description: item.description,
                endsAt: Date.parse(item.endsAt),
                format: "talk",
                location,
                number: item.number,
                ownerMemberId: zurichAi,
                seriesId,
                seriesSlug: item.series,
                slug: item.slug,
                source: "event",
                sourceUrl: item.sourceUrl,
                speakers: item.speakers,
                startsAt: Date.parse(item.startsAt),
                status: "finished",
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

        return { events: archiveEvents.length, ok: true, series: archiveSeries.length };
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

/** Create or update one seeded event series. */
async function ensureSeries(
    ctx: MutationCtx,
    args: { description: string; ownerMemberId: Id<"members">; slug: string; title: string },
) {
    const now = Date.now();
    const existing = await ctx.db
        .query("series")
        .withIndex("by_slug", (query) => query.eq("slug", args.slug))
        .unique();

    if (existing !== null) {
        await ctx.db.patch(existing._id, {
            description: args.description,
            ownerMemberId: args.ownerMemberId,
            searchText: searchText(args.title, args.description),
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
        searchText: searchText(args.title, args.description),
        slug: args.slug,
        status: "active",
        title: args.title,
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
        number?: number;
        ownerMemberId: Id<"members">;
        seriesId?: Id<"series">;
        seriesSlug?: string;
        slug: string;
        source: "event" | "manual" | "external";
        sourceUrl: string;
        speakers: Array<{ name: string; title?: string }>;
        startsAt: number;
        status?: "scheduled" | "conditional" | "finished";
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
            number: args.number,
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
            location: args.location,
            number: args.number,
            ownerMemberId: args.ownerMemberId,
            seriesId: args.seriesId,
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
        tags: uniqueTags(args.seriesSlug, ...args.tags),
        searchText: searchText(
            args.title,
            args.description,
            args.location,
            args.seriesSlug,
            ...args.tags,
            ...args.speakers.flatMap((speaker) => [speaker.name, speaker.title]),
        ),
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

/** Replace the tags attached to one record. */
async function setTags(
    ctx: MutationCtx,
    subject: "event" | "member" | "series",
    subjectId: Id<"events"> | Id<"members"> | Id<"series">,
    slugs: string[],
) {
    const tagIds: Id<"tags">[] = [];
    for (const slug of [...new Set(slugs)]) {
        tagIds.push(await ensureTag(ctx, subject, slug));
    }
    const existing = await ctx.db
        .query("taggings")
        .withIndex("by_subject_and_subjectId", (query) =>
            query.eq("subject", subject).eq("subjectId", subjectId),
        )
        .collect();

    // remove obsolete taggings
    const desired = new Set(tagIds);
    for (const tagging of existing) {
        if (!desired.has(tagging.tagId)) {
            await ctx.db.delete(tagging._id);
        }
    }

    // insert missing taggings
    const existingIds = new Set(existing.map((tagging) => tagging.tagId));
    for (const tagId of tagIds) {
        if (!existingIds.has(tagId)) {
            await ctx.db.insert("taggings", {
                createdAt: Date.now(),
                subject,
                subjectId,
                tagId,
            });
        }
    }
}

/** Create or return one tag. */
async function ensureTag(ctx: MutationCtx, subject: "event" | "member" | "series", slug: string) {
    const existing = await ctx.db
        .query("tags")
        .withIndex("by_subject_and_slug", (query) => query.eq("subject", subject).eq("slug", slug))
        .unique();

    if (existing !== null) {
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
