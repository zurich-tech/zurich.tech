import { register, requireOpenEvent, registrations } from "../events/registrations";
import { siteOrigin } from "../auth/environment";
import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";

import type { Doc } from "../_generated/dataModel";
import { normalizeEmail } from "../members/emails";

import { enqueue } from "./deliveries";
import { consumeLimit } from "./limits";

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
        await consumeLimit(ctx, `verify:${email}`, 5, 3600000, now);
        await consumeLimit(ctx, "verify", 1000, 3600000, now);

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
        await ctx.db.insert("verifications", {
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
            `Confirm your email address to continue:\n\n${url}\n\nThis link expires in one hour. If you did not request it, you can ignore this email.`,
        );
    },
});

/** Verify an email and atomically create its subscription or event registration. */
export const confirm = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        // require an unused verification link within its lifetime
        const ticket = await ctx.db
            .query("verifications")
            .withIndex("by_token", (range) => range.eq("token", args.token))
            .unique();
        if (!ticket || ticket.expiresAt < Date.now())
            throw new Error("This link has expired. Please request a new one.");
        if (ticket.usedAt)
            throw new Error("This link has already been used. Check your confirmation email.");
        const now = Date.now();

        // registration does not opt someone into optional newsletters
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", ticket.email))
            .unique();
        if (subscription?.status === "suppressed")
            throw new Error("This address cannot receive email.");
        if (ticket.purpose === "subscription") {
            const values = {
                email: ticket.email,
                status: "subscribed" as const,
                weekly: true,
                token: subscription?.token ?? ticket.newsletterToken,
                verifiedAt: now,
                updatedAt: now,
            };
            if (subscription) await ctx.db.patch(subscription._id, values);
            else
                await ctx.db.insert("subscriptions", {
                    ...values,
                    createdAt: now,
                    source: "website",
                });
        }
        await ctx.db.patch(ticket._id, { usedAt: now });

        // finish newsletter confirmation without allocating attendance
        if (ticket.purpose === "subscription") return "You’re subscribed.";
        return await register(ctx, ticket, now);
    },
});
