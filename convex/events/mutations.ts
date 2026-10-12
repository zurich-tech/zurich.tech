import { validateTopics } from "../topics/queries";
import { normaliseAffiliations } from "../members/affiliations";
import { links } from "../mail/personalization";
import { internal } from "../_generated/api";
import { validateConfirmation, sameConfirmation } from "./conditions";
import { scheduleDecision, settle } from "./confirmation";
import { queueAnnouncement } from "./mail";
import { eventAction, confirmAction } from "./actions";
import { notificationChanges } from "./changes";
import { eventPlace, validateAddress } from "./place";
import { eventEmail, eventChanges } from "../mail/templates";
import { readLinks, writeLinks } from "../members/links";
import { validatePrimaryOrganiser, validateCoOrganisers, publicOrganisers } from "./organisers";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireEvent, requireRevision } from "../auth/grants";
import { requireAdmin, requireMailSender } from "../auth/access";
import { eventFields, submissionFields } from "./fields";
import { normalizeUrl, normalizeImageUrl } from "../members/urls";
import { promoteWaitlist } from "./registrations";
import { create as createCampaign } from "../mail/campaigns";

/** Save a draft while preserving its published revision. */
export const save = mutation({
    args: {
        id: v.optional(v.id("submissions")),
        publish: v.optional(v.boolean()),
        announce: v.optional(v.boolean()),
        receipt: v.optional(v.string()),
        ...submissionFields,
    },
    handler: async (ctx, args) => {
        const { id, publish, announce, receipt, ...values } = args;
        if (announce && !publish) throw new ConvexError("Publish the event before announcing it.");
        const existing = id ? await ctx.db.get(id) : null;
        if (id && !existing) throw new ConvexError("Submission not found.");
        const viewer = await requireRevision(
            ctx,
            existing,
            values.seriesId,
            publish ? "organiser" : "editor",
        );

        const event = existing?.eventId ? await ctx.db.get(existing.eventId) : null;
        if (existing?.eventId && !event) throw new ConvexError("Published event not found.");
        if (event?.status === "cancelled")
            throw new ConvexError(
                "Cancelled events cannot be edited. Duplicate the event instead.",
            );
        // editor saves remain in submissions; only publication changes the live event
        if (publish) {
            if (receipt === undefined) throw new ConvexError("Confirm publication first.");
            const action = await eventAction(ctx, event, "publish", values, announce);
            if (announce) await requireAdmin(ctx);
            if (action.requiresMail) await requireMailSender(ctx);
            confirmAction(action, receipt);
        }

        await validateTopics(ctx, values.topics, existing?.topics);

        // Public credits are the sole organiser selection.
        await validatePrimaryOrganiser(ctx, values.primaryOrganiserId);
        values.primaryOrganiserId = args.primaryOrganiserId;
        values.coOrganiserIds = args.coOrganiserIds;
        await validateCoOrganisers(ctx, values.coOrganiserIds);
        values.addressAccess = args.addressAccess;

        // Clear undisclosed placeholders and validate the same policy used at publication.
        validateAddress(values, publish);
        if (values.addressAccess?.kind === "unannounced") {
            values.address = undefined;
            values.latitude = undefined;
            values.longitude = undefined;
        }

        // allow planning drafts before their description and venue are confirmed
        if (publish && (!values.description.trim() || !values.location.trim()))
            throw new ConvexError("Add a description and venue before publishing.");

        // validate authored content before accepting a draft
        if (!values.title.trim() || values.title.length > 180)
            throw new ConvexError("Enter a title of at most 180 characters.");
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug))
            throw new ConvexError("Use a lowercase URL slug with hyphens.");
        if (
            values.description.length > 50000 ||
            (values.summary?.length ?? 0) > 500 ||
            values.location.length > 500 ||
            (values.address?.length ?? 0) > 500 ||
            values.topics.length > 12
        )
            throw new ConvexError("Event content is too long.");
        if (
            !Number.isFinite(values.startsAt) ||
            (values.endsAt !== undefined && values.endsAt <= values.startsAt)
        )
            throw new ConvexError("The event must end after it starts.");

        // keep physical attendance capacity separate from the registration limit
        if (
            values.venueCapacity !== undefined &&
            (!Number.isInteger(values.venueCapacity) || values.venueCapacity < 1)
        )
            throw new ConvexError("Venue capacity must be a positive whole number.");

        // require a definite end and native registrations for attendance and follow-up
        if (
            (values.checkIn?.isEnabled ||
                values.followUp?.isEnabled ||
                values.feedback?.isEventEnabled ||
                values.feedback?.isSpeakerEnabled) &&
            values.registration.kind !== "native"
        )
            throw new ConvexError("Use zurich.tech registration for check-in and feedback.");
        if (
            values.followUp?.isEnabled &&
            (!values.endsAt ||
                (!event?.followUp?.isEnabled &&
                    values.endsAt + values.followUp.delayHours * 3600000 <= Date.now()))
        )
            throw new ConvexError("Choose a future send time before enabling follow-up.");
        if (
            values.followUp &&
            (!Number.isInteger(values.followUp.delayHours) ||
                values.followUp.delayHours < 1 ||
                values.followUp.delayHours > 168)
        )
            throw new ConvexError("Choose a follow-up delay of 1 to 168 hours.");
        for (const speaker of values.speakers) {
            if (speaker.memberId && !(await ctx.db.get(speaker.memberId)))
                throw new ConvexError("Speaker member not found.");
        }

        // validate speaker links before they can appear in a public event
        if (values.speakers.length > 40) throw new ConvexError("Use at most forty speakers.");
        for (const speaker of values.speakers) {
            if (!speaker.name.trim() || speaker.name.length > 120)
                throw new ConvexError(
                    "Enter a speaker name and an affiliation up to 300 characters.",
                );
            if ((speaker.links?.length ?? 0) > 6)
                throw new ConvexError("Use at most six links per speaker.");
            if (speaker.links) speaker.links = speaker.links.map(normalizeUrl);
            if (speaker.affiliations)
                speaker.affiliations = normaliseAffiliations(speaker.affiliations);
            if (speaker.imageUrl) speaker.imageUrl = normalizeImageUrl(speaker.imageUrl);
            if (speaker.imageDarkUrl)
                speaker.imageDarkUrl = normalizeImageUrl(speaker.imageDarkUrl);
        }
        // validate the external destination and any published capacity
        if (values.registration.kind === "external") {
            values.registration.url = normalizeUrl(values.registration.url);
            const capacity = values.registration.capacity;
            if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 1))
                throw new ConvexError("Capacity must be a positive whole number.");
        }
        // validate admission limits and questions
        if (values.registration.kind === "native") {
            const policy = values.registration;
            if (
                policy.capacity !== null &&
                (!Number.isInteger(policy.capacity) || policy.capacity < 1)
            )
                throw new ConvexError("Capacity must be a positive whole number.");
            if (policy.closesAt !== undefined && policy.closesAt > values.startsAt)
                throw new ConvexError("Registration must close by the event start.");
            if (
                policy.questions.length > 10 ||
                policy.questions.some(
                    (question) => !question.label.trim() || question.label.length > 200,
                )
            )
                throw new ConvexError("Use at most ten questions, each up to 200 characters.");
        }
        validateConfirmation(values.confirmation, values.registration, values.startsAt);
        if (
            publish &&
            values.confirmation &&
            values.confirmation.decidesAt <= Date.now() &&
            !event?.confirmedAt
        )
            throw new ConvexError("Set a confirmation deadline in the future.");

        // require a complete geographic coordinate pair
        if (
            (values.latitude === undefined) !== (values.longitude === undefined) ||
            (values.latitude !== undefined &&
                (!Number.isFinite(values.latitude) || Math.abs(values.latitude) > 90)) ||
            (values.longitude !== undefined &&
                (!Number.isFinite(values.longitude) || Math.abs(values.longitude) > 180))
        )
            throw new ConvexError("Enter valid latitude and longitude together.");

        // reject missing series and organisation references
        if (values.seriesId) {
            const series = await ctx.db.get(values.seriesId);
            if (!series) throw new ConvexError("Series not found.");
            if (series.status === "archived" && values.seriesId !== existing?.seriesId)
                throw new ConvexError("Restore the series before adding events.");
        }
        for (const id of values.organisations)
            if (!(await ctx.db.get(id))) throw new ConvexError("Organisation not found.");

        // require partners to be linked event organisations
        if (values.partnerIds?.some((id) => !values.organisations.includes(id)))
            throw new ConvexError("Partners must be linked event organisations.");

        // keep changes separate until an authorised person publishes them
        const record = {
            ...values,
            status: "draft" as const,
            updatedAt: Date.now(),
        };
        const draftId =
            existing?._id ??
            (await ctx.db.insert("submissions", {
                ...record,
                ownerId: viewer.memberId,
            }));
        if (existing) await ctx.db.patch(existing._id, record);
        // reserve an event identity so unpublished events can receive scoped assignments
        if (!publish && !existing?.eventId) {
            const collision = await ctx.db
                .query("events")
                .withIndex("by_slug", (q) => q.eq("slug", values.slug))
                .unique();
            if (collision) throw new ConvexError("An event already uses this URL.");
            const eventId = await ctx.db.insert("events", {
                ...eventFields(values),
                ownerId: viewer.memberId,
                status: "draft",
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
            await ctx.db.patch(draftId, { eventId });
        }
        if (publish) {
            const eventId = await publishEvent(ctx, draftId);
            if (announce) await queueAnnouncement(ctx, (await ctx.db.get(eventId))!);
        }

        return draftId;
    },
});

/** Publish an authorised revision into the public calendar atomically. */
export async function publishEvent(ctx: MutationCtx, id: Id<"submissions">) {
    // load the validated revision
    const draft = await ctx.db.get(id);
    if (!draft) throw new ConvexError("Submission not found.");
    validateAddress(draft, true);

    // Recurring publications validate affiliations just like manually saved revisions.
    for (const speaker of draft.speakers)
        if (speaker.affiliations)
            speaker.affiliations = normaliseAffiliations(speaker.affiliations);

    // reserve a stable public URL for this event
    const collision = await ctx.db
        .query("events")
        .withIndex("by_slug", (range) => range.eq("slug", draft.slug))
        .unique();
    if (collision && collision._id !== draft.eventId)
        throw new ConvexError("An event already uses this URL.");
    const now = Date.now();
    const existing = draft.eventId ? await ctx.db.get(draft.eventId) : null;
    if (draft.eventId && !existing) throw new ConvexError("Published event not found.");

    // preserve existing registrations and reject incompatible policy changes
    if (existing) {
        const attendees = await ctx.db
            .query("registrations")
            .withIndex("by_event", (range) => range.eq("eventId", existing._id))
            .collect();
        const active = attendees.filter(
            (row) => row.status !== "cancelled" && row.status !== "declined",
        );
        const confirmed = active.filter((row) => row.status === "going").length;
        if (existing.status === "cancelled")
            throw new ConvexError("Duplicate a cancelled event to schedule it again.");
        if (existing.status !== "draft" && existing.slug !== draft.slug)
            throw new ConvexError("A published event's URL cannot change.");
        if (
            (active.length > 0 || existing.confirmedAt !== undefined) &&
            !sameConfirmation(existing.confirmation, draft.confirmation)
        )
            throw new ConvexError(
                "Keep confirmation requirements unchanged after registration or confirmation. Confirm or cancel this occurrence instead.",
            );
        if (active.length > 0) {
            const previous = existing.registration;
            const next = draft.registration;
            if (
                previous.kind !== "native" ||
                next.kind !== "native" ||
                previous.admission !== next.admission ||
                previous.questions.length !== next.questions.length ||
                previous.questions.some(
                    (question, index) =>
                        question.label.trim() !== next.questions[index]?.label.trim() ||
                        question.isRequired !== next.questions[index]?.isRequired,
                )
            )
                throw new ConvexError(
                    "Keep the registration method, admission policy, and questions unchanged while registrations exist.",
                );
        }
        if (
            draft.registration.kind === "native" &&
            draft.registration.capacity !== null &&
            draft.registration.capacity < confirmed
        )
            throw new ConvexError("Capacity is below confirmed attendance.");
    }
    const credits = await publicOrganisers(
        ctx,
        draft,
        draft.seriesId ? await ctx.db.get(draft.seriesId) : null,
    );
    if (draft.startsAt > Date.now() && !credits.organiser)
        throw new ConvexError("Choose a public primary organiser, directly or through the series.");
    await validatePrimaryOrganiser(ctx, draft.primaryOrganiserId);
    await validateCoOrganisers(ctx, draft.coOrganiserIds);

    // retain a shared venue only while its name, address and map position match
    const previousPlace = existing ? await eventPlace(ctx, existing) : undefined;
    const keepsVenue =
        previousPlace &&
        previousPlace.location === draft.location &&
        previousPlace.address === (draft.address ?? "") &&
        previousPlace.latitude === draft.latitude &&
        previousPlace.longitude === draft.longitude;

    // build the public revision from approved fields
    const values = {
        ownerId: draft.ownerId,
        ...eventFields(draft),
        visibility: draft.visibility ?? existing?.visibility,
        summary: draft.summary ?? existing?.summary,
        venueId: keepsVenue ? existing?.venueId : undefined,
        approvedAt: draft.confirmation?.isApprovalRequired ? existing?.approvedAt : undefined,
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
            (existing.startsAt > now || draft.startsAt > now) &&
            notificationChanges({ ...existing, ...previousPlace }, draft).length > 0
        ) {
            const message = eventEmail(draft, "Event updated", {
                description: eventChanges({ ...existing, ...previousPlace }, draft),
                manageUrl: links.registration,
            });
            await createCampaign(ctx, {
                key: `event-change:${eventId}:${now}`,
                audience: { kind: "registrations", eventId, status: "active" },
                category: "update",
                eventId,
                seriesId: draft.seriesId,
                content: message,
            });
        }
    }

    // preserve speaking appearances so member links and feedback survive revisions
    const appearances = await ctx.db
        .query("speakers")
        .withIndex("by_event", (q) => q.eq("eventId", eventId))
        .collect();
    const retained = new Set<Id<"speakers">>();
    const linkedSpeakers = [];
    for (const [position, speaker] of draft.speakers.entries()) {
        const { id, links, ...fields } = speaker;
        const previous = id
            ? appearances.find((row) => row._id === id)
            : appearances.find((row) => !retained.has(row._id) && row.name === speaker.name);
        if (id && !previous) throw new ConvexError("Speaker does not belong to this event.");
        if (previous && retained.has(previous._id)) throw new ConvexError("Speaker appears twice.");
        const values = {
            ...fields,
            affiliations: speaker.affiliations,
            eventId,
            position,
            isRemoved: false,
            updatedAt: now,
        };
        const speakerId =
            previous?._id ?? (await ctx.db.insert("speakers", { ...values, createdAt: now }));
        if (previous) await ctx.db.patch(speakerId, values);
        retained.add(speakerId);
        linkedSpeakers.push({ ...speaker, id: speakerId });
        await writeLinks(ctx, speakerId, links ?? []);
    }
    for (const row of appearances) {
        if (!retained.has(row._id))
            await ctx.db.patch(row._id, { isRemoved: true, updatedAt: now });
    }

    // replace the agenda in display order
    for (const row of await ctx.db
        .query("sessions")
        .withIndex("by_event", (range) => range.eq("eventId", eventId))
        .collect())
        await ctx.db.delete(row._id);
    for (const [position, item] of draft.agenda.entries())
        await ctx.db.insert("sessions", {
            eventId,
            ...item,
            position,
            createdAt: now,
            updatedAt: now,
        });

    await scheduleDecision(ctx, (await ctx.db.get(eventId))!);
    // stale schedules recheck the current policy and end time before sending
    if (draft.followUp?.isEnabled && draft.endsAt)
        await ctx.scheduler.runAt(
            draft.endsAt + draft.followUp.delayHours * 3600000,
            internal.mail.followup.deliver,
            { eventId, cursor: null },
        );

    // mark the submission as the published revision
    await ctx.db.patch(draft._id, {
        status: "published",
        speakers: linkedSpeakers,
        eventId,
        updatedAt: now,
    });

    return eventId;
}

/** Open an editable revision of an existing event, including imported archive entries. */
export const edit = mutation({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        // require editing access before opening the revision
        await requireEvent(ctx, args.eventId, "editor");
        const event = await ctx.db.get(args.eventId);
        if (!event) throw new ConvexError("You cannot edit this event.");

        // reuse the existing revision when the event is already editable
        const existing = await ctx.db
            .query("submissions")
            .withIndex("by_event", (q) => q.eq("eventId", event._id))
            .unique();
        if (existing) return existing._id;

        // copy editable fields while retaining the event identity and its attendee history
        const speakers = await ctx.db
            .query("speakers")
            .withIndex("by_event_and_position", (q) => q.eq("eventId", event._id))
            .collect();
        const agenda = await ctx.db
            .query("sessions")
            .withIndex("by_event_and_position", (q) => q.eq("eventId", event._id))
            .collect();

        return await ctx.db.insert("submissions", {
            ownerId: event.ownerId,
            visibility: event.visibility,
            primaryOrganiserId: event.primaryOrganiserId,
            coOrganiserIds: event.coOrganiserIds,
            addressAccess: event.addressAccess,
            eventId: event._id,
            status: "published",
            title: event.title,
            slug: event.slug,
            description: event.description ?? "",
            summary: event.summary,
            format: event.format,
            seriesId: event.seriesId,
            topics: event.topics,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            ...(await eventPlace(ctx, event)),
            registration: event.registration,
            venueCapacity: event.venueCapacity,
            checkIn: event.checkIn,
            feedback: event.feedback,
            followUp: event.followUp,
            confirmation: event.confirmation,
            organisations: event.organisationIds ?? [],
            partnerIds: event.partnerIds,
            speakers: await Promise.all(
                speakers
                    .filter((row) => !row.isRemoved)
                    .map(async ({ _id, memberId, name, affiliations, imageUrl, imageDarkUrl }) => ({
                        id: _id,
                        memberId,
                        name,
                        affiliations,
                        links: (await readLinks(ctx, _id)).map((link) => link.url),
                        imageUrl,
                        imageDarkUrl,
                    })),
            ),
            agenda: agenda.map(({ time, title }) => ({ time, title })),
            updatedAt: Date.now(),
        });
    },
});

/** Hide an event and close registration while retaining its attendee records. */
export const unpublish = mutation({
    args: { eventId: v.id("events"), receipt: v.string() },
    handler: async (ctx, args) => {
        await requireEvent(ctx, args.eventId);
        const event = await ctx.db.get(args.eventId);
        if (!event) throw new ConvexError("Event not found.");
        confirmAction(await eventAction(ctx, event, "unpublish"), args.receipt);
        await ctx.db.patch(event._id, { status: "draft", updatedAt: Date.now() });
        const draft = await ctx.db
            .query("submissions")
            .withIndex("by_event", (q) => q.eq("eventId", event._id))
            .unique();
        if (draft) await ctx.db.patch(draft._id, { status: "draft", updatedAt: Date.now() });
    },
});

/** Cancel an event and notify every active attendee. */
export const cancel = mutation({
    args: { eventId: v.id("events"), receipt: v.string() },
    handler: async (ctx, args) => {
        // require organiser access to this event
        await requireEvent(ctx, args.eventId);
        await requireMailSender(ctx);
        const event = await ctx.db.get(args.eventId);
        if (!event) throw new ConvexError("You cannot manage this event.");
        confirmAction(await eventAction(ctx, event, "cancel"), args.receipt);
        await settle(ctx, event, "cancelled");
    },
});
