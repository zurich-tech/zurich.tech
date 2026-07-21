import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { normalizeEmail } from "./email";
import { searchText } from "./search";

const maximumCapacity = 10_000;
const maximumDescriptionLength = 10_000;
const maximumLocationLength = 300;
const maximumNameLength = 120;
const maximumTitleLength = 200;
const hour = 60 * 60 * 1_000;
const day = 24 * hour;

const cadence = v.union(
    v.literal("weekly"),
    v.literal("biweekly"),
    v.literal("monthly"),
    v.literal("quarterly"),
);

const eventFormat = v.union(
    v.literal("meetup"),
    v.literal("talk"),
    v.literal("workshop"),
    v.literal("hackathon"),
    v.literal("office_hours"),
    v.literal("other"),
);

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

/** Submit one event for staff approval. */
export const proposeEvent = mutation({
    args: {
        capacity: v.optional(v.number()),
        description: v.string(),
        format: eventFormat,
        ownerEmail: v.string(),
        startsAt: v.number(),
        title: v.string(),
        venue: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const title = requiredText("title", args.title, maximumTitleLength);
        const description = requiredText("description", args.description, maximumDescriptionLength);
        const location = optionalText("venue", args.venue, maximumLocationLength);
        const email = normalizeEmail(args.ownerEmail);
        const startsAt = futureTime("event date", args.startsAt);
        const capacity = eventCapacity(args.capacity);
        const slug = slugify(title);

        // constrain repeated anonymous submissions
        const now = Date.now();
        await limitSubmission(ctx, `event:${email}`, 3, day, now);
        await limitSubmission(ctx, "event", 100, day, now);

        // reserve a unique event route
        const existing = await ctx.db
            .query("events")
            .withIndex("by_slug", (query) => query.eq("slug", slug))
            .unique();
        if (existing !== null) {
            throw new Error("An event with this title already exists.");
        }

        // resolve the proposal owner
        const ownerMemberId = await memberForEmail(ctx, email, "event_proposal", now);

        return await ctx.db.insert("events", {
            capacity,
            createdAt: now,
            description,
            format: args.format,
            location,
            ownerMemberId,
            slug,
            startsAt,
            status: "proposed",
            title,
            updatedAt: now,
        });
    },
});

/** Submit one recurring series for staff approval. */
export const proposeSeries = mutation({
    args: {
        cadence,
        description: v.string(),
        ownerEmail: v.string(),
        startsAt: v.number(),
        title: v.string(),
    },
    handler: async (ctx, args) => {
        const title = requiredText("title", args.title, maximumTitleLength);
        const description = requiredText("description", args.description, maximumDescriptionLength);
        const email = normalizeEmail(args.ownerEmail);
        const startsAt = futureTime("first event", args.startsAt);
        const slug = slugify(title);

        // constrain repeated anonymous submissions
        const now = Date.now();
        await limitSubmission(ctx, `series:${email}`, 3, day, now);
        await limitSubmission(ctx, "series", 50, day, now);

        // reserve a unique series route
        const existing = await ctx.db
            .query("series")
            .withIndex("by_slug", (query) => query.eq("slug", slug))
            .unique();
        if (existing !== null) {
            throw new Error("A series with this title already exists.");
        }

        // create the proposed schedule and owner atomically
        const ownerMemberId = await memberForEmail(ctx, email, "series_proposal", now);
        const recurrence = recurrenceFor(args.cadence);
        const recurrenceId = await ctx.db.insert("recurrences", {
            ...recurrence,
            createdAt: now,
            startsAt,
            timezone: "Europe/Zurich",
            updatedAt: now,
        });

        return await ctx.db.insert("series", {
            createdAt: now,
            description,
            ownerMemberId,
            recurrenceId,
            searchText: searchText(title, description, args.cadence),
            slug,
            status: "proposed",
            title,
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

/** Resolve or create the private member that owns an email address. */
async function memberForEmail(
    ctx: MutationCtx,
    email: string,
    source: string,
    now: number,
): Promise<Id<"members">> {
    const existing = await memberEmailByAddress(ctx, email);

    // return the existing owner after checking its reference
    if (existing !== null) {
        const member = await ctx.db.get(existing.memberId);

        // reject a broken email ownership graph
        if (member === null) {
            throw new Error(`Email ${existing._id} refers to a missing member.`);
        }

        // reject ownership attributed to disabled members
        if (member.status === "blocked" || member.status === "deleted") {
            throw new Error("This member cannot submit proposals.");
        }

        return member._id;
    }

    // create an unclaimed private member
    const memberId = await ctx.db.insert("members", {
        createdAt: now,
        name: email,
        searchText: email,
        source,
        status: "imported",
        updatedAt: now,
        visibility: "private",
    });
    await ctx.db.insert("memberEmails", {
        createdAt: now,
        email,
        isPrimary: true,
        memberId,
        source,
        updatedAt: now,
    });

    return memberId;
}

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

/** Validate one optional trimmed text value. */
function optionalText(
    name: string,
    value: string | undefined,
    maximumLength: number,
): string | undefined {
    // omit empty optional text
    if (value === undefined || value.trim().length === 0) {
        return undefined;
    }

    return requiredText(name, value, maximumLength);
}

/** Validate one future timestamp. */
function futureTime(name: string, value: number): number {
    // reject invalid and elapsed dates
    if (!Number.isFinite(value) || value <= Date.now()) {
        throw new Error(`${name} must be in the future.`);
    }

    return value;
}

/** Validate one optional event capacity. */
function eventCapacity(value: number | undefined): number | undefined {
    // omit unspecified capacity
    if (value === undefined) {
        return undefined;
    }

    // require a practical whole attendee count
    if (!Number.isInteger(value) || value < 1 || value > maximumCapacity) {
        throw new Error(`capacity must be between 1 and ${maximumCapacity}.`);
    }

    return value;
}

/** Convert one cadence choice into a recurrence interval. */
function recurrenceFor(value: "biweekly" | "monthly" | "quarterly" | "weekly") {
    // weekly
    if (value === "weekly") {
        return { frequency: "weekly" as const, interval: 1 };
    }

    // every two weeks
    if (value === "biweekly") {
        return { frequency: "weekly" as const, interval: 2 };
    }

    // monthly
    if (value === "monthly") {
        return { frequency: "monthly" as const, interval: 1 };
    }

    return { frequency: "monthly" as const, interval: 3 };
}

/** Convert one title into a route slug. */
function slugify(value: string): string {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    // require a usable route segment
    if (slug.length === 0) {
        throw new Error("title must contain letters or numbers.");
    }

    return slug;
}
