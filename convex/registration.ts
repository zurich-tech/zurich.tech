import { siteOrigin } from "./environment";
import { v } from "convex/values";
import {
    action,
    mutation,
    query,
    internalMutation,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { normalizeEmail } from "./email";
import { resolveSeat } from "./event";
import { requireAccount } from "./access";
import { enqueue, requireMail } from "./mail";
import { consumeSubmissionLimit } from "./limit";

/** Send a verification link without allocating an unverified seat. */
export const rsvp = action({
    args: {
        email: v.string(),
        eventSlug: v.string(),
        name: v.string(),
        answers: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args): Promise<{ status: "verification" }> => {
        requireMail();
        await ctx.runMutation(internal.registration.prepare, {
            ...args,
            token: crypto.randomUUID() + crypto.randomUUID(),
            newsletterToken: crypto.randomUUID() + crypto.randomUUID(),
            purpose: "registration",
        });

        return { status: "verification" };
    },
});

/** Send a subscription confirmation without subscribing an unverified address. */
export const subscribe = action({
    args: { email: v.string() },
    handler: async (ctx, args): Promise<void> => {
        requireMail();
        await ctx.runMutation(internal.registration.prepare, {
            email: args.email,
            name: "",
            token: crypto.randomUUID() + crypto.randomUUID(),
            newsletterToken: crypto.randomUUID() + crypto.randomUUID(),
            purpose: "subscription",
        });
    },
});

/** Validate and retain a short lived email verification request. */
export const prepare = internalMutation({
    args: {
        email: v.string(),
        name: v.string(),
        token: v.string(),
        newsletterToken: v.string(),
        purpose: v.union(v.literal("registration"), v.literal("subscription")),
        eventSlug: v.optional(v.string()),
        answers: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args) => {
        // normalize the recipient and enforce hourly email limits
        const email = normalizeEmail(args.email);
        const now = Date.now();
        await consumeSubmissionLimit(ctx, `verify:${email}`, 5, 3600000, now);
        await consumeSubmissionLimit(ctx, "verify", 1000, 3600000, now);

        // validate event eligibility before issuing a verification link
        let eventId: Doc<"events">["_id"] | undefined;
        if (args.purpose === "registration") {
            if (!args.name.trim() || args.name.length > 120)
                throw new Error("Enter your name, up to 120 characters.");
            const event = await ctx.db
                .query("events")
                .withIndex("by_slug", (range) => range.eq("slug", args.eventSlug!))
                .unique();
            if (!event) throw new Error("Event not found.");
            const policy = requireOpenEvent(event);
            const answers = args.answers ?? [];
            if (
                answers.length !== policy.questions.length ||
                answers.some((answer) => answer.length > 2000) ||
                policy.questions.some(
                    (question, index) => question.isRequired && !answers[index]?.trim(),
                )
            )
                throw new Error("Answer the required event questions.");
            if (policy.overflow === "closed" && policy.capacity !== null) {
                const rows = await registrations(ctx, event);
                if (rows.filter((row) => row.status === "going").length >= policy.capacity)
                    throw new Error("This event is full.");
            }
            eventId = event._id;
        }
        // reject suppressed recipients before queueing mail
        const existing = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (range) => range.eq("email", email))
            .collect();
        if (existing.some((row) => row.status === "suppressed"))
            throw new Error("This address cannot receive email.");

        // retain the verification request and independent unsubscribe token
        await ctx.db.insert("tickets", {
            email,
            name: args.name.trim(),
            eventId,
            purpose: args.purpose,
            token: args.token,
            newsletterToken: args.newsletterToken,
            answers: args.answers ?? [],
            expiresAt: now + 3600000,
        });

        // queue the confirmation link with the future events notice
        const url = `${siteOrigin()}/confirm?token=${encodeURIComponent(args.token)}`;
        await enqueue(
            ctx,
            `verify:${args.token}`,
            email,
            args.purpose === "subscription"
                ? "Confirm your zurich.tech subscription"
                : "Confirm your event registration",
            `Confirm your email address to continue:\n\n${url}\n\nWe’ll also keep you informed about future events. You can unsubscribe at any time.\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
        );
    },
});

/** Verify an email and atomically create its subscription or event registration. */
export const confirm = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        // require an unused verification link within its lifetime
        const ticket = await ctx.db
            .query("tickets")
            .withIndex("by_token", (range) => range.eq("token", args.token))
            .unique();
        if (!ticket || ticket.expiresAt < Date.now())
            throw new Error("This link has expired. Please request a new one.");
        if (ticket.usedAt)
            throw new Error("This link has already been used. Check your confirmation email.");
        const now = Date.now();

        // subscribe verified attendees and newsletter readers through the same confirmation
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", ticket.email))
            .unique();
        if (subscription?.status === "suppressed")
            throw new Error("This address cannot receive email.");
        const subscriptionValues = {
            email: ticket.email,
            status: "subscribed" as const,
            token: subscription?.token ?? ticket.newsletterToken,
            verifiedAt: now,
            updatedAt: now,
        };
        if (subscription) await ctx.db.patch(subscription._id, subscriptionValues);
        else
            await ctx.db.insert("subscriptions", {
                ...subscriptionValues,
                createdAt: now,
                source: "website",
            });
        await ctx.db.patch(ticket._id, { usedAt: now });

        // finish newsletter confirmation without allocating attendance
        if (ticket.purpose === "subscription") return "You’re subscribed.";
        if (!ticket.eventId) throw new Error("The verification request has no event.");
        const event = await ctx.db.get(ticket.eventId);
        if (!event) throw new Error("Event not found.");
        const policy = requireOpenEvent(event);
        const rows = await registrations(ctx, event);
        const existing = rows.find((row) => row.email === ticket.email);
        if (existing && existing.status !== "cancelled") {
            await notify(ctx, event, existing, `remind:${ticket.token}`);

            return "Your existing registration is unchanged. We’ve emailed you its details.";
        }
        // allocate verified attendance or retain the application for review
        const status =
            policy.admission === "approval"
                ? "pending"
                : resolveSeat(policy, rows.filter((row) => row.status === "going").length);
        const values: Omit<Doc<"rsvps">, "_id" | "_creationTime"> = {
            eventId: event._id,
            email: ticket.email,
            name: ticket.name,
            answers: ticket.answers,
            status,
            token: ticket.token,
            approvedAt: policy.admission === "automatic" ? now : undefined,
            updatedAt: now,
            createdAt: now,
        };

        // save the registration before queueing its confirmation
        const id = existing ? existing._id : await ctx.db.insert("rsvps", values);
        if (existing) await ctx.db.patch(id, values);
        const registration = await ctx.db.get(id);
        if (!registration) throw new Error("Registration disappeared.");
        await notify(ctx, event, registration, `registered:${ticket.token}`);

        return status === "pending"
            ? "Your application is awaiting the organiser’s approval."
            : status === "waitlist"
              ? "You’re on the waitlist. We’ll email you when a place opens."
              : "You’re confirmed. Your event details are on their way by email.";
    },
});

/** Read a registration through its private management link. */
export const ticket = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        // resolve the attendee through their private management token
        const row = await ctx.db
            .query("rsvps")
            .withIndex("by_token", (range) => range.eq("token", args.token))
            .unique();
        if (!row) throw new Error("Registration not found.");
        const event = await ctx.db.get(row.eventId);
        if (!event) throw new Error("Event not found.");

        return {
            name: row.name,
            status: row.status,
            eventStatus: event.status,
            title: event.title,
            slug: event.slug,
            startsAt: event.startsAt,
        };
    },
});

/** Cancel a registration and promote the oldest approved waiting attendee. */
export const cancel = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        // resolve the attendee through their private management token
        const row = await ctx.db
            .query("rsvps")
            .withIndex("by_token", (range) => range.eq("token", args.token))
            .unique();
        if (!row) throw new Error("Registration not found.");
        const event = await ctx.db.get(row.eventId);
        if (!event) throw new Error("Event not found.");
        if (row.status === "cancelled") return;
        await ctx.db.patch(row._id, { status: "cancelled", updatedAt: Date.now() });
        await promoteWaitlist(ctx, event);
    },
});

/** Unsubscribe only the address owning this private token. */
export const unsubscribe = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        // resolve the subscriber through their private unsubscribe token
        const row = await ctx.db
            .query("subscriptions")
            .withIndex("by_token", (range) => range.eq("token", args.token))
            .unique();
        if (!row) throw new Error("Subscription not found.");
        if (row.status !== "suppressed")
            await ctx.db.patch(row._id, { status: "unsubscribed", updatedAt: Date.now() });
    },
});

/** Read an event's attendees only for its organiser or the team. */
export const attendees = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        // require event ownership or team access
        const viewer = await requireAccount(ctx);
        const event = await ctx.db.get(args.eventId);
        if (!event || (!viewer.isTeam && event.ownerMemberId !== viewer.memberId))
            throw new Error("You cannot manage this event.");
        const rows = await registrations(ctx, event);

        return { event, rows: rows.map(({ token, ...row }) => row) };
    },
});

/** Approve, decline, or cancel one attendee without exceeding event capacity. */
export const decide = mutation({
    args: {
        id: v.id("rsvps"),
        decision: v.union(v.literal("approve"), v.literal("decline"), v.literal("cancel")),
    },
    handler: async (ctx, args) => {
        // require event ownership or team access
        const viewer = await requireAccount(ctx);
        const row = await ctx.db.get(args.id);
        if (!row) throw new Error("Registration not found.");
        const event = await ctx.db.get(row.eventId);
        if (!event || (!viewer.isTeam && event.ownerMemberId !== viewer.memberId))
            throw new Error("You cannot manage this event.");
        const policy = event.registration;
        if (policy.kind !== "native")
            throw new Error("This event does not use native registration.");

        // never allocate seats after an event has ended or been cancelled
        if (
            args.decision === "approve" &&
            (event.status !== "scheduled" || event.startsAt <= Date.now())
        )
            throw new Error("This event no longer accepts approvals.");
        if (args.decision === "approve" && row.status !== "pending")
            throw new Error("Only pending applications can be approved.");
        if (args.decision === "decline" && row.status !== "pending" && row.status !== "waitlist")
            throw new Error("Only pending or waitlisted applications can be declined.");

        // resolve the decision against current confirmed attendance
        const rows = await registrations(ctx, event);
        const status =
            args.decision === "approve"
                ? resolveSeat(policy, rows.filter((item) => item.status === "going").length)
                : args.decision === "decline"
                  ? "declined"
                  : "cancelled";
        const now = Date.now();

        // record the decision and notify affected attendees
        await ctx.db.patch(row._id, {
            status,
            approvedAt: args.decision === "approve" ? now : row.approvedAt,
            updatedAt: now,
        });
        await notify(ctx, event, { ...row, status }, `decision:${row._id}:${now}`);
        await promoteWaitlist(ctx, event);
    },
});

/** Require a published native event with an open registration period. */
function requireOpenEvent(event: Doc<"events">) {
    // check the native policy and registration window
    const policy = event.registration;
    if (event.status !== "scheduled" || event.startsAt <= Date.now())
        throw new Error("Registration is closed.");
    if (policy.kind !== "native") throw new Error("This event does not accept registrations here.");
    if (policy.closesAt !== undefined && policy.closesAt <= Date.now())
        throw new Error("Registration is closed.");

    return policy;
}

/** Read an event's small, indexed attendee set. */
async function registrations(ctx: Pick<QueryCtx, "db">, event: Doc<"events">) {
    return await ctx.db
        .query("rsvps")
        .withIndex("by_eventId", (range) => range.eq("eventId", event._id))
        .collect();
}

/** Fill available seats from the approved queue in signup order. */
export async function promoteWaitlist(ctx: MutationCtx, event: Doc<"events">) {
    // check the native policy and registration window
    const policy = event.registration;
    if (policy.kind !== "native" || event.status !== "scheduled" || event.startsAt <= Date.now())
        return;
    if (policy.closesAt !== undefined && policy.closesAt <= Date.now()) return;
    // read approved waiting attendees in signup order
    const rows = await registrations(ctx, event);
    let count = rows.filter((row) => row.status === "going").length;
    const waiting = rows
        .filter((row) => row.status === "waitlist" && row.approvedAt !== undefined)
        .sort((a, b) => a.createdAt - b.createdAt);

    // fill available seats and email each promoted attendee
    for (const row of waiting) {
        if (policy.capacity !== null && count >= policy.capacity) break;
        await ctx.db.patch(row._id, { status: "going", updatedAt: Date.now() });
        await notify(
            ctx,
            event,
            { ...row, status: "going" },
            `promote:${row._id}:${row.createdAt}`,
        );
        count++;
    }
}

/** Queue the exact attendee state and a private cancellation link. */
async function notify(ctx: MutationCtx, event: Doc<"events">, row: Doc<"rsvps">, key: string) {
    if (!row.email) throw new Error("Registration has no email address.");
    const labels = {
        going: "You’re confirmed",
        pending: "Your application is awaiting approval",
        waitlist: "You’re on the waitlist",
        declined: "Your application was declined",
        cancelled: "Your registration was cancelled",
    };

    // include the private management link when available
    const manage = row.token
        ? `\n\nManage your registration: ${siteOrigin()}/registration?token=${row.token}`
        : "";
    await enqueue(
        ctx,
        key,
        row.email,
        `${labels[row.status]}: ${event.title}`,
        `${labels[row.status]}.\n\n${event.title}\n${new Date(event.startsAt).toLocaleString("en-GB", { timeZone: "Europe/Zurich" })} (Zürich time)\n${event.location ?? ""}\n\n${siteOrigin()}/events/${event.slug}${manage}`,
    );
}
