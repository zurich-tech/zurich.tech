import type { Doc } from "../_generated/dataModel";
import { isTentative } from "./conditions";
import { v } from "convex/values";
import { query, mutation, type QueryCtx } from "../_generated/server";
import { requireAccount } from "../auth/access";
import { requireEvent } from "../auth/grants";

/** Resolve the event and registration that own a private response. */
async function context(ctx: QueryCtx, token: string) {
    const registration = await ctx.db
        .query("registrations")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
    if (!registration) throw new Error("Registration not found.");
    const event = await ctx.db.get(registration.eventId);
    if (!event) throw new Error("Event not found.");
    return { registration, event };
}

/** Accept responses only from confirmed registrations once the event starts. */
function isOpen(event: Doc<"events">, registration: Doc<"registrations">) {
    return (
        !isTentative(event) &&
        registration.status === "going" &&
        event.status !== "cancelled" &&
        event.status !== "draft" &&
        event.startsAt <= Date.now()
    );
}

/** Read one attendee's feedback form without revealing other responses. */
export const form = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const { registration, event } = await context(ctx, args.token);
        const speakers = await ctx.db
            .query("speakers")
            .withIndex("by_event", (q) => q.eq("eventId", event._id))
            .collect();
        const responses = await ctx.db
            .query("feedback")
            .withIndex("by_registration", (q) => q.eq("registrationId", registration._id))
            .collect();
        return {
            title: event.title,
            slug: event.slug,
            isOpen: isOpen(event, registration),
            isEventEnabled: !!event.feedback?.isEventEnabled,
            speakers: event.feedback?.isSpeakerEnabled
                ? speakers
                      .filter((row) => !row.isRemoved)
                      .map((row) => ({ id: row._id, name: row.name }))
                : [],
            responses: responses.map(({ speakerId, rating, comment }) => ({
                speakerId,
                rating,
                comment,
            })),
        };
    },
});

/** Save a private event or speaker response, retaining one response per target. */
export const save = mutation({
    args: {
        token: v.string(),
        speakerId: v.optional(v.id("speakers")),
        rating: v.optional(v.number()),
        comment: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { registration, event } = await context(ctx, args.token);
        if (!isOpen(event, registration)) throw new Error("Feedback is not open.");
        const speaker = args.speakerId ? await ctx.db.get(args.speakerId) : null;
        if (
            args.speakerId
                ? !event.feedback?.isSpeakerEnabled ||
                  !speaker ||
                  speaker.eventId !== event._id ||
                  speaker.isRemoved
                : !event.feedback?.isEventEnabled
        )
            throw new Error("Feedback is disabled.");
        const comment = args.comment?.trim() || undefined;
        if (
            args.rating !== undefined &&
            (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5)
        )
            throw new Error("Choose a rating from 1 to 5.");
        if ((comment?.length ?? 0) > 4000 || (args.rating === undefined && !comment))
            throw new Error("Add a rating or a comment of up to 4,000 characters.");

        // update the existing response rather than counting another vote
        const rows = await ctx.db
            .query("feedback")
            .withIndex("by_registration", (q) => q.eq("registrationId", registration._id))
            .collect();
        const existing = rows.find((row) => row.speakerId === args.speakerId);
        const values = {
            eventId: event._id,
            registrationId: registration._id,
            speakerId: args.speakerId,
            rating: args.rating,
            comment,
            updatedAt: Date.now(),
        };
        if (existing) await ctx.db.patch(existing._id, values);
        else await ctx.db.insert("feedback", { ...values, createdAt: Date.now() });
    },
});

/** Return private responses to the team or to the member who gave the talk. */
export const received = query({
    args: { eventId: v.optional(v.id("events")) },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        if (args.eventId) await requireEvent(ctx, args.eventId);
        const appearances = args.eventId
            ? await ctx.db
                  .query("speakers")
                  .withIndex("by_event", (q) => q.eq("eventId", args.eventId!))
                  .collect()
            : await ctx.db
                  .query("speakers")
                  .withIndex("by_member", (q) => q.eq("memberId", account.memberId))
                  .collect();
        const rows = args.eventId
            ? await ctx.db
                  .query("feedback")
                  .withIndex("by_event", (q) => q.eq("eventId", args.eventId!))
                  .collect()
            : (
                  await Promise.all(
                      appearances.map((row) =>
                          ctx.db
                              .query("feedback")
                              .withIndex("by_speaker", (q) => q.eq("speakerId", row._id))
                              .collect(),
                      ),
                  )
              ).flat();
        const speakers = new Map(appearances.map((row) => [row._id, row.name]));
        const events = new Map(
            await Promise.all(
                [...new Set(rows.map((row) => row.eventId))].map(async (id) => {
                    const event = await ctx.db.get(id);
                    if (!event) throw new Error("Feedback event not found.");
                    return [id, event.title] as const;
                }),
            ),
        );
        return rows.map((row) => ({
            id: row._id,
            event: events.get(row.eventId)!,
            speaker: row.speakerId ? speakers.get(row.speakerId) : undefined,
            rating: row.rating,
            comment: row.comment,
        }));
    },
});
