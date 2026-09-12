import { eventEmail, registrationCopy } from "../mail/templates";
import { siteOrigin } from "../auth/environment";
import { v } from "convex/values";
import {
    action,
    internalMutation,
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";

import { resolveSeat } from "./fields";
import { authComponent } from "../auth/component";
import { normalizeEmail } from "../members/emails";
import { consumeLimit } from "../mail/limits";
import { requireAccount, requireTeam } from "../auth/access";
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

/** Register a signed-in member without repeating email verification. */
export const join = action({
    args: { eventSlug: v.string(), answers: v.array(v.string()) },
    handler: async (ctx, args): Promise<string> => {
        requireMail();
        return await ctx.runMutation(internal.events.registrations.joinMember, {
            ...args,
            token: crypto.randomUUID() + crypto.randomUUID(),
        });
    },
});

/** Derive attendee identity from the verified session and apply admission rules. */
export const joinMember = internalMutation({
    args: { eventSlug: v.string(), answers: v.array(v.string()), token: v.string() },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        const user = await authComponent.getAuthUser(ctx);
        if (!user.emailVerified) throw new Error("Verify your account email before registering.");
        const member = await ctx.db.get(account.memberId);
        if (!member) throw new Error("Profile not found.");
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (q) => q.eq("slug", args.eventSlug))
            .unique();
        if (!event) throw new Error("Event not found.");
        const policy = requireOpenEvent(event);
        if (
            args.answers.length !== policy.questions.length ||
            args.answers.some((answer) => answer.length > 2000) ||
            policy.questions.some(
                (question, index) => question.isRequired && !args.answers[index]?.trim(),
            )
        )
            throw new Error("Answer the required event questions.");
        const email = normalizeEmail(user.email);
        await consumeLimit(ctx, `register:${account.memberId}`, 5, 3600000, Date.now());

        return await register(
            ctx,
            {
                eventId: event._id,
                memberId: member._id,
                email,
                name: member.name,
                answers: args.answers,
                token: args.token,
            },
            Date.now(),
        );
    },
});

/** Read only the signed-in member's registration, including a verified guest RSVP. */
export const current = query({
    args: { eventSlug: v.string() },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        const user = await authComponent.getAuthUser(ctx);
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (q) => q.eq("slug", args.eventSlug))
            .unique();
        if (!event) return null;

        // match member ownership first, then the verified sign-in email
        const owned = await ctx.db
            .query("registrations")
            .withIndex("by_member", (q) => q.eq("memberId", account.memberId))
            .collect();
        let row = owned.find((row) => row.eventId === event._id);
        if (!row && user.emailVerified) {
            row =
                (await ctx.db
                    .query("registrations")
                    .withIndex("by_event_and_email", (q) =>
                        q.eq("eventId", event._id).eq("email", normalizeEmail(user.email)),
                    )
                    .unique()) ?? undefined;
        }
        return row ? { status: row.status, token: row.token } : null;
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
            email: row.email,
            summary: event.summary,
            location: event.location,
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
        if (row.status === "declined") throw new Error("This registration was declined.");
        if (event.status === "cancelled" || event.startsAt <= Date.now())
            throw new Error("This event no longer accepts registration changes.");
        await ctx.db.patch(row._id, { status: "cancelled", updatedAt: Date.now() });
        await promoteWaitlist(ctx, event);
    },
});

/** Read an event's attendees for the team. */
export const list = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        // require team access
        await requireTeam(ctx);
        const event = await ctx.db.get(args.eventId);
        if (!event) throw new Error("You cannot manage this event.");
        const rows = await registrations(ctx, event);

        return { event, rows: rows.map(({ token, ...row }) => row) };
    },
});

/** Review admission and manage attendance without exceeding event capacity. */
export const decide = mutation({
    args: {
        id: v.id("registrations"),
        decision: v.union(
            v.literal("approve"),
            v.literal("waitlist"),
            v.literal("rescind"),
            v.literal("decline"),
            v.literal("cancel"),
        ),
    },
    handler: async (ctx, args) => {
        // require team access
        await requireTeam(ctx);
        const row = await ctx.db.get(args.id);
        if (!row) throw new Error("Registration not found.");
        const event = await ctx.db.get(row.eventId);
        if (!event) throw new Error("You cannot manage this event.");
        const policy = event.registration;
        if (policy.kind !== "native")
            throw new Error("This event does not use native registration.");

        // never allocate seats after an event has ended or been cancelled
        if (
            ["approve", "waitlist", "rescind"].includes(args.decision) &&
            (event.status !== "scheduled" || event.startsAt <= Date.now())
        )
            throw new Error("Admission is closed for this event.");
        if (args.decision === "approve" && row.status !== "pending" && row.status !== "waitlist")
            throw new Error("Only pending or waitlisted applications can be approved.");
        if (args.decision === "waitlist" && row.status !== "pending" && row.status !== "going")
            throw new Error("Only pending or confirmed attendees can be waitlisted.");
        if (
            args.decision === "rescind" &&
            row.status !== "going" &&
            !(row.status === "waitlist" && row.approvedAt !== undefined)
        )
            throw new Error("This registration has no approval to rescind.");
        if (args.decision === "cancel" && (row.status === "cancelled" || row.status === "declined"))
            throw new Error("This registration is already closed.");
        if (args.decision === "decline" && row.status !== "pending" && row.status !== "waitlist")
            throw new Error("Only pending or waitlisted applications can be declined.");

        // resolve the decision against current confirmed attendance
        const rows = await registrations(ctx, event);
        const status =
            args.decision === "approve"
                ? resolveSeat(policy, rows.filter((item) => item.status === "going").length)
                : args.decision === "waitlist"
                  ? "waitlist"
                  : args.decision === "rescind"
                    ? "pending"
                    : args.decision === "decline"
                      ? "declined"
                      : "cancelled";
        const now = Date.now();

        // record the decision and notify affected attendees
        await ctx.db.patch(row._id, {
            status,
            approvedAt: args.decision === "approve" ? now : undefined,
            updatedAt: now,
        });
        await notify(ctx, event, { ...row, status }, `decision:${row._id}:${args.decision}:${now}`);
        if (row.status === "going" && status !== "going") await promoteWaitlist(ctx, event);
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
    const waiting = waitingForSeats(event, await registrations(ctx, event));

    // fill available seats and email each promoted attendee
    for (const row of waiting) {
        await ctx.db.patch(row._id, { status: "going", updatedAt: Date.now() });
        await notify(
            ctx,
            event,
            { ...row, status: "going" },
            `promote:${row._id}:${row.updatedAt}:${Date.now()}`,
        );
    }
}

/** Select approved waitlisted registrations that fit the event's open seats. */
export function waitingForSeats(
    event: Pick<Doc<"events">, "registration" | "status" | "startsAt">,
    rows: Doc<"registrations">[],
) {
    const policy = event.registration;
    const now = Date.now();
    if (
        policy.kind !== "native" ||
        event.status !== "scheduled" ||
        event.startsAt <= now ||
        (policy.closesAt !== undefined && policy.closesAt <= now)
    )
        return [];
    const confirmed = rows.filter((row) => row.status === "going").length;
    const available =
        policy.capacity === null ? rows.length : Math.max(0, policy.capacity - confirmed);

    return rows
        .filter((row) => row.status === "waitlist" && row.approvedAt !== undefined)
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, available);
}

/** Queue the exact attendee state and a private cancellation link. */
async function notify(
    ctx: MutationCtx,
    event: Doc<"events">,
    row: Doc<"registrations">,
    key: string,
) {
    if (!row.email) throw new Error("Registration has no email address.");
    const copy = registrationCopy[row.status];

    // keep private management actions on active registrations
    const message = eventEmail(event, copy.title, {
        ...copy,
        manageUrl:
            row.token && row.status !== "declined" && row.status !== "cancelled"
                ? `${siteOrigin()}/registration?token=${encodeURIComponent(row.token)}`
                : undefined,
    });
    await enqueue(ctx, key, row.email, message.subject, message.text, undefined, 0, message.html);
}

/** Allocate a verified attendee through the event admission policy. */
export async function register(
    ctx: MutationCtx,
    ticket: Pick<Doc<"verifications">, "eventId" | "email" | "name" | "answers" | "token"> & {
        memberId?: Doc<"members">["_id"];
    },
    now: number,
) {
    if (!ticket.eventId) throw new Error("The verification request has no event.");
    const event = await ctx.db.get(ticket.eventId);
    if (!event) throw new Error("Event not found.");
    const policy = requireOpenEvent(event);
    const rows = await registrations(ctx, event);
    const existing = rows.find(
        (row) =>
            (ticket.memberId !== undefined && row.memberId === ticket.memberId) ||
            row.email === ticket.email,
    );
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
        memberId: ticket.memberId ?? existing?.memberId,
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
