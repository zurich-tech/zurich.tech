import { siteOrigin } from "./environment";
import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { requireAccount, requireTeam } from "./access";
import { submissionFields } from "./event";
import { normalizeUrl, normalizeImageUrl } from "./url";
import { promoteWaitlist } from "./registration";
import { enqueue } from "./mail";

/** Save a draft or submit it for review, preserving any published revision. */
export const save = mutation({
    args: { id: v.optional(v.id("submissions")), submit: v.boolean(), ...submissionFields },
    handler: async (ctx, args) => {
        // require ownership or team access before changing an event
        const viewer = await requireAccount(ctx);
        const { id, submit, ...values } = args;
        const existing = id ? await ctx.db.get(id) : null;
        if (id && !existing) throw new Error("Submission not found.");
        if (existing && existing.ownerMemberId !== viewer.memberId && !viewer.isTeam)
            throw new Error("This event belongs to another organiser.");

        // validate public content before accepting a draft
        if (!values.title.trim() || values.title.length > 180)
            throw new Error("Enter a title of at most 180 characters.");
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug))
            throw new Error("Use a lowercase URL slug with hyphens.");
        if (
            values.description.length > 50000 ||
            values.location.length > 500 ||
            values.topics.length > 12
        )
            throw new Error("Event content is too long.");
        if (
            !Number.isFinite(values.startsAt) ||
            (values.endsAt !== undefined && values.endsAt <= values.startsAt)
        )
            throw new Error("The event must end after it starts.");

        // validate speaker links before they can appear in a public event
        if (values.speakers.length > 40) throw new Error("Use at most forty speakers.");
        for (const speaker of values.speakers) {
            if (!speaker.name.trim() || speaker.name.length > 120 || speaker.title.length > 300)
                throw new Error("Enter a speaker name and an affiliation up to 300 characters.");
            if ((speaker.links?.length ?? 0) > 6)
                throw new Error("Use at most six links per speaker.");
            if (speaker.links) speaker.links = speaker.links.map(normalizeUrl);
            if (speaker.imageUrl) speaker.imageUrl = normalizeImageUrl(speaker.imageUrl);
            if (speaker.imageDarkUrl)
                speaker.imageDarkUrl = normalizeImageUrl(speaker.imageDarkUrl);
        }
        // validate the external destination and any published capacity
        if (values.registration.kind === "external") {
            values.registration.url = normalizeUrl(values.registration.url);
            const capacity = values.registration.capacity;
            if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1))
                throw new Error("Capacity must be a positive whole number.");
        }
        // validate admission limits and questions
        if (values.registration.kind === "native") {
            const policy = values.registration;
            if (
                policy.capacity !== null &&
                (!Number.isInteger(policy.capacity) || policy.capacity < 1)
            )
                throw new Error("Capacity must be a positive whole number.");
            if (policy.closesAt !== undefined && policy.closesAt > values.startsAt)
                throw new Error("Registration must close by the event start.");
            if (
                policy.questions.length > 10 ||
                policy.questions.some(
                    (question) => !question.label.trim() || question.label.length > 200,
                )
            )
                throw new Error("Use at most ten questions, each up to 200 characters.");
        }
        // require a complete geographic coordinate pair
        if (
            (values.latitude === undefined) !== (values.longitude === undefined) ||
            (values.latitude !== undefined &&
                (!Number.isFinite(values.latitude) || Math.abs(values.latitude) > 90)) ||
            (values.longitude !== undefined &&
                (!Number.isFinite(values.longitude) || Math.abs(values.longitude) > 180))
        )
            throw new Error("Enter valid latitude and longitude together.");

        // reject missing series and organisation references
        if (values.seriesId && !(await ctx.db.get(values.seriesId)))
            throw new Error("Series not found.");
        for (const id of values.organisations)
            if (!(await ctx.db.get(id))) throw new Error("Organisation not found.");

        // keep changes separate until an authorised person publishes them
        const status = submit ? ("review" as const) : ("draft" as const);
        const record = { ...values, status, updatedAt: Date.now() };
        if (existing) {
            await ctx.db.patch(existing._id, record);

            return existing._id;
        }
        // bound unpublished drafts per organiser
        const pending = await ctx.db
            .query("submissions")
            .withIndex("by_owner", (range) => range.eq("ownerMemberId", viewer.memberId))
            .collect();
        if (pending.filter((item) => item.status !== "published").length >= 20)
            throw new Error("You have twenty open drafts. Publish or finish those first.");

        return await ctx.db.insert("submissions", { ...record, ownerMemberId: viewer.memberId });
    },
});

/** Publish an authorised revision into the public calendar atomically. */
export const publish = mutation({
    args: { id: v.id("submissions") },
    handler: async (ctx, args) => {
        // require ownership or team access before changing an event
        const viewer = await requireAccount(ctx);
        const draft = await ctx.db.get(args.id);
        if (!draft) throw new Error("Submission not found.");
        if (!viewer.isTeam && (!viewer.canPublish || draft.ownerMemberId !== viewer.memberId))
            throw new Error("Publishing permission is required.");

        // reserve a stable public URL for this event
        const collision = await ctx.db
            .query("events")
            .withIndex("by_slug", (range) => range.eq("slug", draft.slug))
            .unique();
        if (collision && collision._id !== draft.eventId)
            throw new Error("An event already uses this URL.");
        const now = Date.now();
        const existing = draft.eventId ? await ctx.db.get(draft.eventId) : null;
        if (draft.eventId && !existing) throw new Error("Published event not found.");

        // preserve existing registrations and reject incompatible policy changes
        if (existing) {
            const attendees = await ctx.db
                .query("rsvps")
                .withIndex("by_eventId", (range) => range.eq("eventId", existing._id))
                .collect();
            const active = attendees.filter(
                (row) => row.status !== "cancelled" && row.status !== "declined",
            );
            const confirmed = active.filter((row) => row.status === "going").length;
            if (existing.status === "cancelled")
                throw new Error("Duplicate a cancelled event to schedule it again.");
            if (existing.slug !== draft.slug)
                throw new Error("A published event's URL cannot change.");
            if (active.length > 0) {
                const previous = existing.registration;
                const next = draft.registration;
                if (
                    previous.kind !== "native" ||
                    next.kind !== "native" ||
                    previous.admission !== next.admission ||
                    JSON.stringify(previous.questions) !== JSON.stringify(next.questions)
                )
                    throw new Error(
                        "Keep the registration method, admission policy, and questions unchanged while registrations exist.",
                    );
            }
            if (
                draft.registration.kind === "native" &&
                draft.registration.capacity !== null &&
                draft.registration.capacity < confirmed
            )
                throw new Error("Capacity is below confirmed attendance.");
        }
        // build the public revision from approved fields
        const values = {
            ownerMemberId: draft.ownerMemberId,
            slug: draft.slug,
            title: draft.title,
            description: draft.description,
            summary: draft.description.slice(0, 220),
            format: draft.format,
            seriesId: draft.seriesId,
            topics: draft.topics,
            startsAt: draft.startsAt,
            endsAt: draft.endsAt,
            location: draft.location,
            venueId: existing?.location === draft.location ? existing.venueId : undefined,
            latitude: draft.latitude,
            longitude: draft.longitude,
            registration: draft.registration,
            organisationIds: draft.organisations,
            status: draft.startsAt < now ? ("finished" as const) : ("scheduled" as const),
            updatedAt: now,
        };

        // publish the revision and fill newly available seats
        const eventId = existing
            ? existing._id
            : await ctx.db.insert("events", { ...values, createdAt: now });
        if (existing) {
            await ctx.db.patch(eventId, values);
            await promoteWaitlist(ctx, { ...existing, ...values });

            // email active attendees when the time or venue changes
            if (
                existing.startsAt !== draft.startsAt ||
                existing.endsAt !== draft.endsAt ||
                existing.location !== draft.location
            ) {
                const attendees = await ctx.db
                    .query("rsvps")
                    .withIndex("by_eventId", (range) => range.eq("eventId", eventId))
                    .collect();
                for (const attendee of attendees)
                    if (
                        attendee.email &&
                        attendee.status !== "cancelled" &&
                        attendee.status !== "declined"
                    )
                        await enqueue(
                            ctx,
                            `event-change:${eventId}:${now}:${attendee._id}`,
                            attendee.email,
                            `Updated: ${draft.title}`,
                            `The time or location has changed.\n\n${draft.title}\n${new Date(draft.startsAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich" })} (Zürich time)\n${draft.location}\n\n${siteOrigin()}/events/${draft.slug}`,
                        );
            }
        }
        // replace small ordered lists without creating competing event records
        for (const row of await ctx.db
            .query("eventSpeakers")
            .withIndex("by_eventId", (range) => range.eq("eventId", eventId))
            .collect())
            await ctx.db.delete(row._id);
        for (const [position, speaker] of draft.speakers.entries())
            await ctx.db.insert("eventSpeakers", {
                eventId,
                ...speaker,
                position,
                createdAt: now,
                updatedAt: now,
            });

        // replace the agenda in display order
        for (const row of await ctx.db
            .query("eventAgendaItems")
            .withIndex("by_eventId", (range) => range.eq("eventId", eventId))
            .collect())
            await ctx.db.delete(row._id);
        for (const [position, item] of draft.agenda.entries())
            await ctx.db.insert("eventAgendaItems", {
                eventId,
                ...item,
                position,
                createdAt: now,
                updatedAt: now,
            });

        // mark the submission as the published revision
        await ctx.db.patch(draft._id, {
            status: "published",
            eventId,
            reviewNote: undefined,
            updatedAt: now,
        });

        return eventId;
    },
});

/** Return a submission to its organiser with an explicit review note. */
export const decline = mutation({
    args: { id: v.id("submissions"), note: v.string() },
    handler: async (ctx, args) => {
        await requireTeam(ctx);
        if (!args.note.trim()) throw new Error("Explain what needs to change.");
        await ctx.db.patch(args.id, {
            status: "declined",
            reviewNote: args.note,
            updatedAt: Date.now(),
        });
    },
});

/** Open an editable revision of an existing event, including imported archive entries. */
export const edit = mutation({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        // require ownership or team access before changing an event
        const viewer = await requireAccount(ctx);
        const event = await ctx.db.get(args.eventId);
        if (!event || (!viewer.isTeam && event.ownerMemberId !== viewer.memberId))
            throw new Error("You cannot edit this event.");

        // reuse the existing revision when the event is already editable
        const existing = await ctx.db
            .query("submissions")
            .filter((q) => q.eq(q.field("eventId"), event._id))
            .unique();
        if (existing) return existing._id;

        // copy editable fields while retaining the event identity and its attendee history
        const speakers = await ctx.db
            .query("eventSpeakers")
            .withIndex("by_eventId_and_position", (q) => q.eq("eventId", event._id))
            .collect();
        const agenda = await ctx.db
            .query("eventAgendaItems")
            .withIndex("by_eventId_and_position", (q) => q.eq("eventId", event._id))
            .collect();

        return await ctx.db.insert("submissions", {
            ownerMemberId: event.ownerMemberId,
            eventId: event._id,
            status: "published",
            title: event.title,
            slug: event.slug,
            description: event.description ?? "",
            format: event.format,
            seriesId: event.seriesId,
            topics: event.topics,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            location: event.location ?? "",
            latitude: event.latitude,
            longitude: event.longitude,
            registration: event.registration,
            organisations: event.organisationIds ?? [],
            speakers: speakers.map(({ name, title, links, imageUrl, imageDarkUrl }) => ({
                name,
                title: title ?? "",
                links,
                imageUrl,
                imageDarkUrl,
            })),
            agenda: agenda.map(({ time, title }) => ({ time, title })),
            updatedAt: Date.now(),
        });
    },
});

/** Cancel an event and notify every active attendee. */
export const cancel = mutation({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        // require event ownership or team access
        const viewer = await requireAccount(ctx);
        const event = await ctx.db.get(args.eventId);
        if (!event || (!viewer.isTeam && event.ownerMemberId !== viewer.memberId))
            throw new Error("You cannot manage this event.");
        if (event.status === "cancelled") return;
        // cancel the event before notifying its active attendees
        await ctx.db.patch(event._id, { status: "cancelled", updatedAt: Date.now() });

        // read the event's attendees before queueing cancellation notices
        const attendees = await ctx.db
            .query("rsvps")
            .withIndex("by_eventId", (range) => range.eq("eventId", event._id))
            .collect();
        for (const row of attendees)
            if (row.email && row.status !== "cancelled" && row.status !== "declined")
                await enqueue(
                    ctx,
                    `cancel-event:${event._id}:${row._id}`,
                    row.email,
                    `Cancelled: ${event.title}`,
                    `${event.title} has been cancelled.\n\n${siteOrigin()}/events/${event.slug}`,
                );
    },
});

/** Apply reviewed event copy and speaker links without republishing or notifying attendees. */
export const backfill = internalMutation({
    args: {
        apply: v.boolean(),
        events: v.array(
            v.object({ slug: v.string(), summary: v.string(), description: v.string() }),
        ),
        speakers: v.array(v.object({ name: v.string(), links: v.array(v.string()) })),
    },
    handler: async (ctx, args) => {
        // validate destinations before changing any records
        const profiles = new Map(
            args.speakers.map((speaker) => {
                if (speaker.links.length > 6)
                    throw new Error(`Too many links for ${speaker.name}.`);
                const links = speaker.links.map((url) => normalizeUrl(url));

                return [speaker.name, links] as const;
            }),
        );
        const now = Date.now();
        let eventCount = 0;
        let speakerCount = 0;
        let submissionCount = 0;

        // change only the reviewed public text, preserving scheduling and registrations
        for (const values of args.events) {
            const event = await ctx.db
                .query("events")
                .withIndex("by_slug", (range) => range.eq("slug", values.slug))
                .unique();
            if (!event) throw new Error(`Event not found: ${values.slug}.`);
            if (event.summary !== values.summary || event.description !== values.description) {
                eventCount += 1;
                if (args.apply)
                    await ctx.db.patch(event._id, {
                        summary: values.summary,
                        description: values.description,
                        updatedAt: now,
                    });
            }
        }

        // update every appearance of each reviewed speaker
        const speakers = await ctx.db.query("eventSpeakers").collect();
        for (const name of profiles.keys()) {
            if (!speakers.some((speaker) => speaker.name === name))
                throw new Error(`Speaker not found: ${name}.`);
        }
        for (const speaker of speakers) {
            const links = profiles.get(speaker.name);
            if (links && JSON.stringify(links) !== JSON.stringify(speaker.links ?? [])) {
                speakerCount += 1;
                if (args.apply) await ctx.db.patch(speaker._id, { links, updatedAt: now });
            }
        }

        // keep published source submissions aligned without overwriting unreviewed drafts
        const submissions = await ctx.db
            .query("submissions")
            .withIndex("by_status", (range) => range.eq("status", "published"))
            .collect();
        for (const submission of submissions) {
            const description =
                args.events.find((event) => event.slug === submission.slug)?.description ??
                submission.description;
            const speakers = submission.speakers.map((speaker) => {
                const links = profiles.get(speaker.name);

                return links ? { ...speaker, links } : speaker;
            });
            if (
                description !== submission.description ||
                JSON.stringify(speakers) !== JSON.stringify(submission.speakers)
            ) {
                submissionCount += 1;
                if (args.apply)
                    await ctx.db.patch(submission._id, { description, speakers, updatedAt: now });
            }
        }

        return {
            applied: args.apply,
            events: eventCount,
            speakers: speakerCount,
            submissions: submissionCount,
        };
    },
});
