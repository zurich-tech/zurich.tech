import { v } from "convex/values";

import { mutation, type MutationCtx } from "./_generated/server";
import { normalizeEmail } from "./email";

const maximumNameLength = 120;
const hour = 60 * 60 * 1_000;

/** Subscribe one address to a public topic. */
export const subscribe = mutation({
    args: {
        email: v.string(),
        topic: v.union(v.literal("newsletter"), v.literal("events")),
    },
    handler: async (ctx, args) => {
        const email = normalizeEmail(args.email);
        const now = Date.now();

        // constrain repeated anonymous submissions
        await limitSubmission(ctx, `subscribe:${email}`, 5, hour, now);
        await limitSubmission(ctx, "subscribe", 1_000, hour, now);

        // update one existing subscription
        const existing = await ctx.db
            .query("subscriptions")
            .withIndex("by_email_and_topic", (query) =>
                query.eq("email", email).eq("topic", args.topic),
            )
            .unique();
        if (existing !== null) {
            // retain suppression as a hard delivery invariant
            if (existing.status === "suppressed") {
                throw new Error("This address cannot be subscribed.");
            }

            await ctx.db.patch(existing._id, { status: "subscribed", updatedAt: now });

            return existing._id;
        }

        // associate a known member without requiring an account
        const memberEmail = await memberEmailByAddress(ctx, email);

        return await ctx.db.insert("subscriptions", {
            createdAt: now,
            email,
            memberId: memberEmail?.memberId,
            source: "website",
            status: "subscribed",
            topic: args.topic,
            updatedAt: now,
        });
    },
});

/** Register or restore one RSVP for a published event. */
export const rsvp = mutation({
    args: {
        email: v.string(),
        eventSlug: v.string(),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        const email = normalizeEmail(args.email);
        const name = requiredText("name", args.name, maximumNameLength);
        const now = Date.now();

        // constrain repeated anonymous registrations
        await limitSubmission(ctx, `rsvp:${email}`, 10, hour, now);
        await limitSubmission(ctx, "rsvp", 1_000, hour, now);

        // resolve one published event with open registration
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (query) => query.eq("slug", args.eventSlug))
            .unique();
        if (event === null) {
            throw new Error("Event not found.");
        }
        if (event.status !== "scheduled" && event.status !== "conditional") {
            throw new Error("RSVPs are closed for this event.");
        }

        // require the event to be in the public calendar
        const calendarEntry = await ctx.db
            .query("calendarEntries")
            .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
            .unique();
        if (calendarEntry === null || calendarEntry.status !== "published") {
            throw new Error("RSVPs are closed for this event.");
        }

        // preserve capacity by moving overflow registrations to the waitlist
        const existing = await ctx.db
            .query("rsvps")
            .withIndex("by_eventId_and_email", (query) =>
                query.eq("eventId", event._id).eq("email", email),
            )
            .unique();
        const going = await ctx.db
            .query("rsvps")
            .withIndex("by_eventId", (query) => query.eq("eventId", event._id))
            .filter((query) => query.eq(query.field("status"), "going"))
            .collect();
        const goingCount = going.filter((entry) => entry._id !== existing?._id).length;
        const status =
            event.capacity !== undefined && goingCount >= event.capacity ? "waitlist" : "going";

        // update or insert the registration
        const memberEmail = await memberEmailByAddress(ctx, email);
        if (existing !== null) {
            await ctx.db.patch(existing._id, {
                memberId: memberEmail?.memberId,
                name,
                status,
                updatedAt: now,
            });

            return { id: existing._id, status };
        }

        const id = await ctx.db.insert("rsvps", {
            createdAt: now,
            email,
            eventId: event._id,
            memberId: memberEmail?.memberId,
            name,
            status,
            updatedAt: now,
        });

        return { id, status };
    },
});

/** Find the unique member email for one normalized address. */
async function memberEmailByAddress(ctx: MutationCtx, email: string) {
    return await ctx.db
        .query("memberEmails")
        .withIndex("by_email", (query) => query.eq("email", email))
        .unique();
}

/** Consume one anonymous submission allowance. */
async function limitSubmission(
    ctx: MutationCtx,
    key: string,
    maximum: number,
    duration: number,
    now: number,
) {
    const limit = await ctx.db
        .query("submissionLimits")
        .withIndex("by_key", (query) => query.eq("key", key))
        .unique();

    // begin the first window
    if (limit === null) {
        await ctx.db.insert("submissionLimits", {
            count: 1,
            key,
            startedAt: now,
            updatedAt: now,
        });

        return;
    }

    // begin a new elapsed window
    if (now - limit.startedAt >= duration) {
        await ctx.db.patch(limit._id, { count: 1, startedAt: now, updatedAt: now });

        return;
    }

    // reject exhausted windows
    if (limit.count >= maximum) {
        throw new Error("Too many submissions. Try again later.");
    }

    // consume the next allowance
    await ctx.db.patch(limit._id, { count: limit.count + 1, updatedAt: now });
}

/** Validate one required trimmed text value. */
function requiredText(name: string, value: string, maximumLength: number): string {
    const text = value.trim();

    // reject missing text
    if (text.length === 0) {
        throw new Error(`${name} is required.`);
    }

    // reject oversized text
    if (text.length > maximumLength) {
        throw new Error(`${name} must be at most ${maximumLength} characters.`);
    }

    return text;
}
