import { emailPreferences } from "./enrollment";
import { requireRecipient, recipientsLocked } from "./policy";
import { subscriptionHistory } from "./history";
import { verificationEmail } from "./templates";
import { register, requireOpenEvent, registrations } from "../events/registrations";
import { siteOrigin } from "../auth/environment";
import { ConvexError, v } from "convex/values";
import { mutation, internalMutation, query } from "../_generated/server";

import type { Doc } from "../_generated/dataModel";
import { normalizeEmail } from "../members/emails";

import { enqueue } from "./messages";
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
        requireRecipient(email);
        const now = Date.now();
        await consumeLimit(ctx, `verify:${email}`, 5, 3600000, now);
        await consumeLimit(ctx, "verify", 1000, 3600000, now);

        // validate event eligibility before issuing a verification link
        let event: Doc<"events"> | undefined;
        if (args.purpose === "registration") {
            if (!args.name.trim() || args.name.length > 120)
                throw new ConvexError("Enter your name, up to 120 characters.");
            const found = await ctx.db
                .query("events")
                .withIndex("by_slug", (range) => range.eq("slug", args.eventSlug!))
                .unique();
            if (!found) throw new ConvexError("Event not found.");
            event = found;
            const policy = requireOpenEvent(event);
            const answers = args.answers ?? [];
            if (
                answers.length !== policy.questions.length ||
                answers.some((answer) => answer.length > 2000) ||
                policy.questions.some(
                    (question, index) => question.isRequired && !answers[index]?.trim(),
                )
            )
                throw new ConvexError("Answer the required event questions.");
            if (policy.overflow === "closed" && policy.capacity !== null) {
                const rows = await registrations(ctx, event);
                if (rows.filter((row) => row.status === "going").length >= policy.capacity)
                    throw new ConvexError("This event is full.");
            }
        }
        // reject suppressed recipients before queueing mail
        const existing = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (range) => range.eq("email", email))
            .collect();
        if (existing.some((row) => row.status === "suppressed"))
            throw new ConvexError("This address cannot receive email.");

        // retain the verification request and independent unsubscribe token
        const expiresAt = now + 3600000;
        await ctx.db.insert("verifications", {
            email,
            name: args.name.trim(),
            eventId: event?._id,
            purpose: args.purpose,
            token: args.token,
            newsletterToken: args.newsletterToken,
            answers: args.answers ?? [],
            expiresAt,
        });

        // queue the email verification link
        const url = `${siteOrigin()}/confirm?token=${encodeURIComponent(args.token)}`;
        const message = verificationEmail(url, event);
        await enqueue(
            ctx,
            `verify:${args.token}`,
            email,
            message.subject,
            message.text,
            undefined,
            0,
            message.html,
            { expiresAt },
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
        if (!ticket || ticket.expiresAt <= Date.now())
            throw new ConvexError("This link has expired. Please request a new one.");
        if (ticket.usedAt)
            throw new ConvexError(
                "This link has already been used. Check your confirmation email.",
            );
        const now = Date.now();

        // explicit subscription confirmation may renew a previous opt-out
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", ticket.email))
            .unique();
        if (subscription?.status === "suppressed")
            throw new ConvexError("This address cannot receive email.");
        if (ticket.purpose === "subscription") {
            const values = {
                email: ticket.email,
                status: "subscribed" as const,
                ...emailPreferences,
                token: subscription?.token ?? ticket.newsletterToken,
                verifiedAt: now,
                updatedAt: now,
            };
            const history = subscriptionHistory(subscription, values, now, "confirmation");
            if (subscription) await ctx.db.patch(subscription._id, { ...values, history });
            else
                await ctx.db.insert("subscriptions", {
                    ...values,
                    history,
                    createdAt: now,
                    source: "website",
                });
        }
        await ctx.db.patch(ticket._id, { usedAt: now });

        // finish newsletter confirmation without allocating attendance
        if (ticket.purpose === "subscription")
            return recipientsLocked()
                ? "You’re subscribed. Test mode: newsletter delivery is off until Test mode is turned off."
                : "You’re subscribed.";
        return await register(ctx, ticket, now);
    },
});

/** Read a private verification link without consuming it. */
export const status = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const ticket = await ctx.db
            .query("verifications")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!ticket) return null;
        return {
            purpose: ticket.purpose,
            status: ticket.usedAt
                ? ("confirmed" as const)
                : ticket.expiresAt <= Date.now()
                  ? ("expired" as const)
                  : ("pending" as const),
        };
    },
});
