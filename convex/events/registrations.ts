import { siteOrigin } from "../auth/environment";
import { v } from "convex/values";
import { action, mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";

import { resolveSeat } from "./fields";
import { requireAccount } from "../auth/access";
import { enqueue, requireMail } from "../mail/deliveries";

/** Send a verification link without allocating an unverified seat. */
export const request = action({
    args: {
        email: v.string(),
        eventSlug: v.string(),
        name: v.string(),
        answers: v.optional(v.array(v.string())),
    },
    handler: async (ctx, args): Promise<{ status: "verification" }> => {
        requireMail();
        await ctx.runMutation(internal.mail.verification.prepare, {
            ...args,
            token: crypto.randomUUID() + crypto.randomUUID(),
            newsletterToken: crypto.randomUUID() + crypto.randomUUID(),
            purpose: "registration",
        });

        return { status: "verification" };
    },
});

/** Read a registration through its private management link. */
export const get = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        // resolve the attendee through their private management token
        const row = await ctx.db
            .query("registrations")
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
            .query("registrations")
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

/** Read an event's attendees only for its organiser or the team. */
export const list = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        // require event ownership or team access
        const viewer = await requireAccount(ctx);
        const event = await ctx.db.get(args.eventId);
        if (!event || (!viewer.isTeam && event.ownerId !== viewer.memberId))
            throw new Error("You cannot manage this event.");
        const rows = await registrations(ctx, event);

        return { event, rows: rows.map(({ token, ...row }) => row) };
    },
});

/** Approve, decline, or cancel one attendee without exceeding event capacity. */
export const decide = mutation({
    args: {
        id: v.id("registrations"),
        decision: v.union(v.literal("approve"), v.literal("decline"), v.literal("cancel")),
    },
    handler: async (ctx, args) => {
        // require event ownership or team access
        const viewer = await requireAccount(ctx);
        const row = await ctx.db.get(args.id);
        if (!row) throw new Error("Registration not found.");
        const event = await ctx.db.get(row.eventId);
        if (!event || (!viewer.isTeam && event.ownerId !== viewer.memberId))
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
export function requireOpenEvent(event: Doc<"events">) {
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
export async function registrations(ctx: Pick<QueryCtx, "db">, event: Doc<"events">) {
    return await ctx.db
        .query("registrations")
        .withIndex("by_event", (range) => range.eq("eventId", event._id))
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
async function notify(
    ctx: MutationCtx,
    event: Doc<"events">,
    row: Doc<"registrations">,
    key: string,
) {
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

/** Allocate a verified attendee through the event admission policy. */
export async function register(ctx: MutationCtx, ticket: Doc<"verifications">, now: number) {
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
    const values: Omit<Doc<"registrations">, "_id" | "_creationTime"> = {
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
    const id = existing ? existing._id : await ctx.db.insert("registrations", values);
    if (existing) await ctx.db.patch(id, values);
    const registration = await ctx.db.get(id);
    if (!registration) throw new Error("Registration disappeared.");
    await notify(ctx, event, registration, `registered:${ticket.token}`);

    return status === "pending"
        ? "Your application is awaiting the organiser’s approval."
        : status === "waitlist"
          ? "You’re on the waitlist. We’ll email you when a place opens."
          : "You’re confirmed. Your event details are on their way by email.";
}
