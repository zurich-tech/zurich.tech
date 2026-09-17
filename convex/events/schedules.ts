import { isListed } from "./visibility";
import { requireAudienceDelivery } from "../mail/policy";
import { validateAddress } from "./place";
import { v } from "convex/values";
import {
    mutation,
    query,
    internalMutation,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { requireWorkspace, requireSeries, requireRevision, requireSchedule } from "../auth/grants";
import { allows } from "../auth/permissions";
import { publicOrganisers } from "./organisers";
import { recurrence, occurrences, validateRecurrence } from "./recurrence";
import { eventFields, revisionFields } from "./fields";
import { validateConfirmation } from "./conditions";
import { publishEvent } from "./mutations";
import { requireMail } from "../mail/provider";
import { receivesAnnouncement } from "../mail/events";

/** List editable schedules and their materialised occurrences for the team. */
export const list = query({
    args: {},
    handler: async (ctx) => {
        const access = await requireWorkspace(ctx);
        const schedules = (await ctx.db.query("schedules").collect()).filter((schedule) =>
            allows(access, { seriesId: schedule.seriesId }, "organiser"),
        );
        return await Promise.all(
            schedules.map(async (schedule) => ({
                ...schedule,
                announcedAt: (await ctx.db.get(schedule.seriesId))?.announcedAt,
                events: (
                    await ctx.db
                        .query("events")
                        .withIndex("by_schedule_and_occurrence", (q) =>
                            q.eq("scheduleId", schedule._id),
                        )
                        .collect()
                )
                    .sort((a, b) => a.startsAt - b.startsAt)
                    .map((event) => ({
                        id: event._id,
                        title: event.title,
                        slug: event.slug,
                        startsAt: event.startsAt,
                        status: event.status,
                        occurrence: event.occurrence,
                        confirmation: event.confirmation,
                        confirmedAt: event.confirmedAt,
                    })),
            })),
        );
    },
});

/** Save recurrence rules; existing occurrences keep their individually authored details. */
export const save = mutation({
    args: {
        id: v.optional(v.id("schedules")),
        seriesId: v.id("series"),
        sourceId: v.optional(v.id("submissions")),
        title: v.optional(v.string()),
        recurrence,
        publication: v.union(v.literal("draft"), v.literal("published")),
        status: v.union(v.literal("active"), v.literal("paused")),
    },
    handler: async (ctx, args) => {
        const viewer = await requireSeries(ctx, args.seriesId);
        validateRecurrence(args.recurrence);
        const series = await ctx.db.get(args.seriesId);
        if (!series) throw new Error("Series not found.");
        const existing = args.id ? await ctx.db.get(args.id) : null;
        if (
            series.status === "archived" &&
            (args.status === "active" || existing?.seriesId !== args.seriesId)
        )
            throw new Error("Restore the series before adding or activating schedules.");
        if (args.id && !existing) throw new Error("Schedule not found.");
        if (existing) await requireSchedule(ctx, existing._id);
        if (existing) {
            const events = await ctx.db
                .query("events")
                .withIndex("by_schedule_and_occurrence", (q) => q.eq("scheduleId", existing._id))
                .collect();
            const skipped = events.find(
                (event) =>
                    event.status !== "cancelled" &&
                    event.occurrence &&
                    args.recurrence.excluded.includes(event.occurrence) &&
                    !existing.recurrence.excluded.includes(event.occurrence),
            );
            if (skipped)
                throw new Error(
                    `${skipped.occurrence} already has an event. Cancel that occurrence first.`,
                );
        }
        const source = args.sourceId ? await ctx.db.get(args.sourceId) : null;
        if (args.sourceId && !source) throw new Error("Template event not found.");
        if (source) await requireRevision(ctx, source, source.seriesId, "organiser");
        if (!existing && !source) throw new Error("Choose a saved event as the template.");
        const template = source ? revisionFields(source) : existing!.template;
        template.seriesId = args.seriesId;
        if (args.title !== undefined) {
            if (!args.title.trim()) throw new Error("Enter an occurrence title.");
            template.title = args.title.trim();
        }
        validateConfirmation(template.confirmation, template.registration, template.startsAt);
        validateAddress(template, args.publication === "published");
        if (
            args.publication === "published" &&
            (!template.description.trim() || !template.location.trim())
        )
            throw new Error(
                "Add a description and venue to the template before publishing occurrences.",
            );
        if (template.endsAt !== undefined && template.endsAt - template.startsAt > 7 * 86400000)
            throw new Error("Recurring events must last at most seven days.");
        const credits = await publicOrganisers(ctx, template, await ctx.db.get(args.seriesId));
        if (!credits.organiser)
            throw new Error("Choose a public primary organiser, directly or through the series.");
        const now = Date.now();
        const values = {
            seriesId: args.seriesId,
            recurrence: args.recurrence,
            publication: args.publication,
            status: args.status,
            template,
            updatedAt: now,
        };
        const id =
            existing?._id ??
            (await ctx.db.insert("schedules", {
                ...values,
                ownerId: viewer.memberId,
                createdAt: now,
            }));
        if (existing) await ctx.db.patch(id, values);

        // adopt a matching source occurrence instead of making a second event on that date
        if (!existing && source?.eventId) {
            const event = await ctx.db.get(source.eventId);
            const match = occurrences(args.recurrence, now).dates.find(
                (row) => row.startsAt === event?.startsAt,
            );
            if (event && match && !event.scheduleId && event.seriesId === args.seriesId) {
                await ctx.db.patch(event._id, {
                    scheduleId: id,
                    occurrence: match.date,
                });
            }
        }
        await generate(ctx, (await ctx.db.get(id))!);

        // reuse a matching draft as the first occurrence, preserving its editor link
        if (!existing && source && !source.eventId && source.seriesId === args.seriesId) {
            const events = await ctx.db
                .query("events")
                .withIndex("by_schedule_and_occurrence", (q) => q.eq("scheduleId", id))
                .collect();
            const event = events.find((event) => event.startsAt === source.startsAt);
            if (event) {
                const generated = await ctx.db
                    .query("submissions")
                    .withIndex("by_event", (q) => q.eq("eventId", event._id))
                    .unique();
                if (generated) {
                    const { _id, _creationTime, ...revision } = generated;
                    await ctx.db.replace(source._id, revision);
                    await ctx.db.delete(_id);
                }
            }
        }
        return id;
    },
});

/** Materialise a rolling six-week window with stable date identities and URLs. */
export async function generate(ctx: MutationCtx, schedule: Doc<"schedules">) {
    if (
        schedule.status !== "active" ||
        (await ctx.db.get(schedule.seriesId))?.status === "archived"
    )
        return;
    const now = Date.now();
    const result = occurrences(schedule.recurrence, now);
    const errors = [...result.errors];
    const existing = await ctx.db
        .query("events")
        .withIndex("by_schedule_and_occurrence", (q) => q.eq("scheduleId", schedule._id))
        .collect();
    const reserved = new Set(existing.map((event) => event.occurrence));
    // Number across the series, including manually created events and other schedules.
    const series = await ctx.db.get(schedule.seriesId);
    if (!series) throw new Error("Series not found.");
    const events = await ctx.db
        .query("events")
        .withIndex("by_series", (q) => q.eq("seriesId", schedule.seriesId))
        .collect();
    let nextNumber = Math.max(
        schedule.nextNumber ?? 1,
        ...events.map((event) => (event.number ?? 0) + 1),
    );
    const credits = await publicOrganisers(
        ctx,
        schedule.template,
        await ctx.db.get(schedule.seriesId),
    );
    if (!credits.organiser) {
        await ctx.db.patch(schedule._id, {
            status: "paused",
            errors: ["Choose a public primary organiser, then resume the schedule."],
        });
        return;
    }
    for (const occurrence of result.dates) {
        if (reserved.has(occurrence.date)) continue;
        const template = schedule.template;
        const shift = occurrence.startsAt - template.startsAt;
        const confirmation = template.confirmation
            ? { ...template.confirmation, decidesAt: template.confirmation.decidesAt + shift }
            : undefined;
        if (confirmation && confirmation.decidesAt <= now) continue;
        const slug = `${series.slug}-${nextNumber}`;
        const collision = await ctx.db
            .query("events")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .unique();
        if (collision) {
            errors.push(`${occurrence.date}: event URL already exists.`);
            continue;
        }
        const fields = {
            ...template,
            title: template.title.replaceAll("${count}", String(nextNumber)),
            speakers: template.speakers.map(({ id, ...speaker }) => speaker),
            slug,
            seriesId: schedule.seriesId,
            startsAt: occurrence.startsAt,
            endsAt: template.endsAt === undefined ? undefined : template.endsAt + shift,
            confirmation,
            registration:
                template.registration.kind === "native"
                    ? {
                          ...template.registration,
                          closesAt:
                              template.registration.closesAt === undefined
                                  ? undefined
                                  : template.registration.closesAt + shift,
                      }
                    : template.registration,
        };
        // insert the occurrence before publication to suppress standalone announcements
        const eventId = await ctx.db.insert("events", {
            ownerId: schedule.ownerId,
            ...eventFields(fields),
            scheduleId: schedule._id,
            occurrence: occurrence.date,
            number: nextNumber,
            status: "draft",
            createdAt: now,
            updatedAt: now,
        });
        const draftId = await ctx.db.insert("submissions", {
            ...fields,
            eventId,
            ownerId: schedule.ownerId,
            status: "draft",
            updatedAt: now,
        });
        if (schedule.publication === "published") await publishEvent(ctx, draftId);
        nextNumber += 1;
    }
    await ctx.db.patch(schedule._id, { errors, nextNumber });
}

/** Generate independently so one invalid schedule cannot prevent another from running. */
export const tick = internalMutation({
    args: {},
    handler: async (ctx) => {
        const schedules = await ctx.db
            .query("schedules")
            .withIndex("by_status", (q) => q.eq("status", "active"))
            .collect();
        for (const schedule of schedules)
            await ctx.scheduler.runAfter(0, internal.events.schedules.fill, { id: schedule._id });
    },
});
export const fill = internalMutation({
    args: { id: v.id("schedules") },
    handler: async (ctx, args) => {
        const schedule = await ctx.db.get(args.id);
        if (schedule) await generate(ctx, schedule);
    },
});

/** Count a single launch announcement across the global event subscribers. */
export const announcement = query({
    args: { id: v.id("schedules") },
    handler: async (ctx, args) => {
        await requireSchedule(ctx, args.id);
        return await announcementPreview(ctx, args.id);
    },
});

/** Announce the recurring series once; occurrences never send individual announcements. */
export const announce = mutation({
    args: { id: v.id("schedules"), receipt: v.string() },
    handler: async (ctx, args) => {
        await requireSchedule(ctx, args.id);
        requireMail();
        requireAudienceDelivery();
        const preview = await announcementPreview(ctx, args.id);
        if (!preview.recipients) throw new Error("No subscribers to announce to.");
        if (preview.receipt !== args.receipt)
            throw new Error("The schedule or recipients changed. Review the announcement again.");
        const now = Date.now();
        const schedule = (await ctx.db.get(args.id))!;
        await ctx.db.patch(schedule.seriesId, { announcedAt: now });
        await ctx.scheduler.runAfter(0, internal.mail.series.announce, {
            scheduleId: args.id,
            publishedAt: now,
            cursor: null,
        });
    },
});

/** Bind approval to the current schedule and exact audience. */
async function announcementPreview(ctx: Pick<QueryCtx, "db">, id: Id<"schedules">) {
    const schedule = await ctx.db.get(id);
    if (!schedule || schedule.status !== "active")
        throw new Error("Activate the schedule before announcing it.");
    const series = await ctx.db.get(schedule.seriesId);
    if (!series || series.announcedAt)
        throw new Error("This series is unavailable or already announced.");
    const events = await ctx.db
        .query("events")
        .withIndex("by_schedule_and_occurrence", (q) => q.eq("scheduleId", id))
        .collect();
    if (
        !events.some(
            (event) =>
                isListed(event) && event.status === "scheduled" && event.startsAt > Date.now(),
        )
    )
        throw new Error("Publish an upcoming occurrence before announcing the series.");
    const subscriptions = await ctx.db.query("subscriptions").collect();
    const now = Date.now();
    const recipients = subscriptions.filter((row) => receivesAnnouncement(row, now));
    return {
        recipients: recipients.length,
        receipt: JSON.stringify([
            id,
            schedule.updatedAt,
            series.name,
            series.description,
            recipients.map((row) => row.email).sort(),
        ]),
    };
}
