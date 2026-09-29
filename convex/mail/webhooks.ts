import { updateMessage } from "./progress";
import { Webhook } from "svix";
import { v } from "convex/values";
import { httpAction, internalMutation, type MutationCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { subscriptionHistory } from "./history";
import { siteOrigin } from "../auth/environment";
import { halve, sendingDate } from "./policy";

const outcomes = ["delivered", "bounced", "complained", "failed", "suppressed"] as const;
const rank = {
    failed: 1,
    delivered: 2,
    suppressed: 3,
    bounced: 4,
    complained: 5,
};

/** Apply provider events only to mail issued by this deployment. */
export async function reconcile(ctx: MutationCtx, providerId: string) {
    const delivery = await ctx.db
        .query("messages")
        .withIndex("by_provider", (q) => q.eq("providerId", providerId))
        .unique();
    if (!delivery) return;
    const events = await ctx.db
        .query("deliveryEvents")
        .withIndex("by_message", (q) => q.eq("providerId", providerId))
        .collect();
    const outcome = events
        .map(
            (event) =>
                (event.type === "bounced" && event.bounceType !== "Permanent"
                    ? "failed"
                    : event.type) as (typeof outcomes)[number],
        )
        .sort((a, b) => rank[b] - rank[a])[0];
    if (!outcome || (delivery.outcome && rank[delivery.outcome] >= rank[outcome])) return;
    await updateMessage(ctx, delivery, { outcome });
    if (outcome !== "bounced" && outcome !== "complained" && outcome !== "suppressed") return;

    // retain explicit opt-outs and record suppression without reactivating old addresses
    const now = Date.now();
    const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_email", (q) => q.eq("email", delivery.to))
        .unique();
    if (subscription?.status !== "suppressed") {
        const values = {
            status: "suppressed" as const,
            updatedAt: now,
            history: subscriptionHistory(
                subscription,
                { status: "suppressed", weekly: subscription?.weekly },
                now,
                `resend:${outcome}`,
            ),
        };
        if (subscription) await ctx.db.patch(subscription._id, values);
        else
            await ctx.db.insert("subscriptions", {
                ...values,
                email: delivery.to,
                createdAt: now,
                source: `resend:${outcome}`,
            });
    }

    // track bounces and stop the rollout on complaints
    if (delivery.isBulk) {
        const settings = await ctx.db.query("mailQuota").unique();
        if (settings) {
            const bounced =
                settings.bounced +
                (outcome === "bounced" && delivery.outcome !== "bounced" ? 1 : 0);
            const complained = settings.complained + (outcome === "complained" ? 1 : 0);
            const shouldPause = complained > 0;
            await ctx.db.patch(settings._id, { bounced, complained });
            const policy = await ctx.db.query("mailPolicy").unique();

            // lower the reviewed pace once per stop and record its date
            if (shouldPause && policy && !policy.isPaused)
                await ctx.db.patch(settings._id, {
                    ceiling: halve(settings.ceiling),
                    stoppedOn: sendingDate(Date.now()),
                });
            if (shouldPause && policy)
                await ctx.db.patch(policy._id, {
                    isPaused: true,
                    pauseReason: "Spam complaint received. Review delivery before resuming.",
                });
        }
    }
}

/** Persist signed events once, including events arriving before provider acceptance is saved. */
export const record = internalMutation({
    args: {
        providerEventId: v.string(),
        providerId: v.string(),
        bounceType: v.optional(v.string()),
        type: v.union(
            v.literal("delivered"),
            v.literal("bounced"),
            v.literal("complained"),
            v.literal("failed"),
            v.literal("suppressed"),
        ),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db
            .query("deliveryEvents")
            .withIndex("by_provider_event", (q) => q.eq("providerEventId", args.providerEventId))
            .unique();
        if (existing) return;
        await ctx.db.insert("deliveryEvents", { ...args, receivedAt: Date.now() });
        await reconcile(ctx, args.providerId);
    },
});

/** Verify the original bytes and timestamp before processing provider data. */
export const receive = httpAction(async (ctx, request) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return new Response("Webhook not configured", { status: 503 });
    if (Number(request.headers.get("content-length") ?? 0) > 100000)
        return new Response(null, { status: 413 });
    const body = await request.text();
    if (body.length > 100000) return new Response(null, { status: 413 });
    let payload: {
        type?: string;
        data?: { email_id?: string; bounce?: { type?: string } };
    };
    try {
        new Webhook(secret).verify(body, {
            "svix-id": request.headers.get("svix-id") ?? "",
            "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
            "svix-signature": request.headers.get("svix-signature") ?? "",
        });
        payload = JSON.parse(body);
    } catch {
        return new Response("Invalid signature", { status: 400 });
    }
    if (!payload || typeof payload.type !== "string")
        return new Response("Invalid event", { status: 400 });
    const type = outcomes.find((value) => `email.${value}` === payload.type);
    if (!type) return new Response(null, { status: 204 });
    if (typeof payload.data?.email_id !== "string" || payload.data.email_id.length > 200)
        return new Response("Invalid event", { status: 400 });
    await ctx.runMutation(internal.mail.webhooks.record, {
        providerEventId: request.headers.get("svix-id")!,
        providerId: payload.data.email_id,
        bounceType:
            type === "bounced" && typeof payload.data.bounce?.type === "string"
                ? payload.data.bounce.type
                : undefined,
        type,
    });
    return new Response(null, { status: 204 });
});

/** RFC 8058 POST requests change consent; GET requests only open the confirmation page. */
export const unsubscribe = httpAction(async (ctx, request) => {
    const token = new URL(request.url).searchParams.get("token");
    if (!token || token.length > 200) return new Response("Invalid link", { status: 400 });
    if (request.method === "GET")
        return Response.redirect(
            `${siteOrigin()}/unsubscribe?token=${encodeURIComponent(token)}`,
            303,
        );
    const body = await request.text();
    if (body.length > 1000 || new URLSearchParams(body).get("List-Unsubscribe") !== "One-Click")
        return new Response("Invalid request", { status: 400 });
    const subscription = await ctx.runQuery(api.mail.subscriptions.status, {
        token,
    });
    if (!subscription) return new Response("Invalid link", { status: 400 });
    await ctx.runMutation(api.mail.subscriptions.unsubscribe, { token });
    return new Response(null, { status: 200 });
});
