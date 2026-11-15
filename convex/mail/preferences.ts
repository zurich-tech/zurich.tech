import { enrollSubscription } from "./enrollment";
import { recipientsLocked } from "./policy";
import { subscriptionHistory } from "./history";
import { insertSubscription, updateSubscription } from "./contacts";
import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireAccount } from "../auth/access";
import { authComponent } from "../auth/component";
import { normalizeEmail } from "../members/emails";
import { preferences, readPreferences } from "./consent";
import { consumeLimit } from "./limits";
import { enqueue } from "./messages";
import { siteOrigin } from "../auth/environment";
import { layout, paragraph } from "./layout";
import { requireMail } from "./provider";

/** Read private email preferences. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        await requireAccount(ctx);
        const user = await authComponent.getAuthUser(ctx);
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", normalizeEmail(user.email)))
            .unique();
        return {
            email: user.email,
            isTestMode: recipientsLocked(),
            ...readPreferences(subscription),
            isSuppressed: subscription?.status === "suppressed",
        };
    },
});

/** Read preferences through the private link delivered to this address. */
export const read = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();

        return subscription
            ? {
                  ...readPreferences(subscription),
                  isSuppressed: subscription.status === "suppressed",
              }
            : null;
    },
});

/** Save explicit choices through the recipient's private email link. */
export const saveLink = mutation({
    args: { token: v.string(), ...preferences },
    handler: async (ctx, { token, ...choices }) => {
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_token", (q) => q.eq("token", token))
            .unique();
        if (!subscription) throw new ConvexError("this email link is invalid");
        if (subscription.status === "suppressed")
            throw new ConvexError("email delivery is blocked for this address; contact the team");

        // explicit saves may enable categories; link visits never change consent
        const now = Date.now();
        const values = {
            ...choices,
            status:
                choices.weekly || choices.announcements
                    ? ("subscribed" as const)
                    : ("unsubscribed" as const),
        };
        await updateSubscription(ctx, subscription._id, {
            ...values,
            updatedAt: now,
            history: subscriptionHistory(subscription, values, now, "preferences"),
        });
    },
});

/** Send a private preferences link without revealing whether an address is subscribed. */
export const request = action({
    args: { email: v.string() },
    handler: async (ctx, args): Promise<void> => {
        requireMail();
        await ctx.runMutation(internal.mail.preferences.prepare, {
            email: args.email,
            token: crypto.randomUUID() + crypto.randomUUID(),
        });
    },
});

/** Rate-limit recovery emails and preserve the existing private token. */
export const prepare = internalMutation({
    args: { email: v.string(), token: v.string() },
    handler: async (ctx, args) => {
        const email = normalizeEmail(args.email);
        const now = Date.now();
        await consumeLimit(ctx, `preferences:${email}`, 3, 3600000, now);
        await consumeLimit(ctx, "preferences", 100, 3600000, now);
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique();
        if (!subscription || subscription.status === "suppressed") return;

        // a recovery request changes neither consent nor an existing valid link
        const token = subscription.token ?? args.token;
        if (!subscription.token) await ctx.db.patch(subscription._id, { token });
        const url = `${siteOrigin()}/unsubscribe?token=${encodeURIComponent(token)}&view=preferences`;
        const title = "Your email preferences";
        const text = "Choose which zurich.tech emails you receive.";
        const html = layout({
            title,
            body: paragraph(text),
            action: { label: "Email preferences", url },
        });
        await enqueue(
            ctx,
            `preferences:${subscription._id}:${now}`,
            email,
            title,
            `${text}\n\nEmail preferences: ${url}`,
            undefined,
            0,
            html,
            { expiresAt: now + 3600000 },
        );
    },
});

/** Generate a private unsubscribe token outside the database transaction. */
export const save = action({
    args: preferences,
    handler: async (ctx, args): Promise<void> => {
        await ctx.runMutation(internal.mail.preferences.update, {
            ...args,
            token: crypto.randomUUID() + crypto.randomUUID(),
        });
    },
});

/** Save preferences only for the verified address belonging to this session. */
export const update = internalMutation({
    args: { ...preferences, token: v.string() },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        const user = await authComponent.getAuthUser(ctx);
        if (!user.emailVerified)
            throw new ConvexError("Verify your email before changing email preferences.");
        const email = normalizeEmail(user.email);
        const existing = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique();
        if (existing?.status === "suppressed")
            throw new ConvexError("Email delivery is blocked for this address. Contact the team.");
        // preserve the existing unsubscribe token when preferences change
        const now = Date.now();
        const values = {
            email,
            memberId: account.memberId,
            weekly: args.weekly,
            announcements: args.announcements,
            reminders: args.reminders,
            followUps: args.followUps,
            status:
                args.weekly || args.announcements
                    ? ("subscribed" as const)
                    : ("unsubscribed" as const),
            token: existing?.token ?? args.token,
            verifiedAt: existing?.verifiedAt ?? now,
            updatedAt: now,
        };
        const history = subscriptionHistory(existing, values, now, "settings");
        if (existing) await updateSubscription(ctx, existing._id, { ...values, history });
        else
            await insertSubscription(ctx, {
                ...values,
                history,
                source: "account",
                createdAt: now,
            });
    },
});

/** Generate the unsubscribe token for a new account. */
export const enroll = internalAction({
    args: { email: v.string(), memberId: v.id("members") },
    handler: async (ctx, args) => {
        await ctx.runMutation(internal.mail.preferences.subscribe, {
            ...args,
            token: crypto.randomUUID() + crypto.randomUUID(),
        });
    },
});

/** Subscribe a new account without overriding an existing email choice. */
export const subscribe = internalMutation({
    args: { email: v.string(), memberId: v.id("members"), token: v.string() },
    handler: async (ctx, args) => {
        await enrollSubscription(ctx, { ...args, source: "account" }, Date.now());
    },
});
