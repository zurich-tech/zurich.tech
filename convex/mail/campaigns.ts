import { canSend } from "./access";
import { v } from "convex/values";
import {
    query,
    mutation,
    internalMutation,
    type QueryCtx,
    type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAdmin } from "../auth/access";
import { requireEvent, requireSeries } from "../auth/grants";
import { authComponent } from "../auth/component";
import { campaignEmail } from "./templates";
import { enqueue } from "./messages";
import { recipientAllowed, recipientsLocked, requireAudienceDelivery } from "./policy";
import { audience, type Audience, type Category, type Content, type Recipient } from "./model";
import { byRecency, select } from "./audiences";
import { links, personalize } from "./personalization";
import { state } from "./sending";
import { consumeLimit } from "./limits";

/** Authorise against the stored scope, never a client-supplied replacement. */
async function authorize(
    ctx: QueryCtx,
    campaign: { eventId?: Id<"events">; seriesId?: Id<"series"> },
) {
    if (campaign.eventId) return await requireEvent(ctx, campaign.eventId);
    if (campaign.seriesId) return await requireSeries(ctx, campaign.seriesId);
    return await requireAdmin(ctx);
}

/** Load a campaign after checking its actual scope. */
async function get(ctx: QueryCtx, id: Id<"campaigns">) {
    const campaign = await ctx.db.get(id);
    if (!campaign) throw new Error("Campaign not found.");
    await authorize(ctx, campaign);
    return campaign;
}

/** Render written content through the shared code template. */
function render(campaign: Doc<"campaigns">) {
    return (
        campaign.content ??
        campaignEmail(
            campaign,
            campaign.audience?.kind === "subscribers" ? links.unsubscribe : undefined,
        )
    );
}

/** List scoped campaigns without exposing recipient identities or private links. */
export const list = query({
    args: { eventId: v.optional(v.id("events")) },
    handler: async (ctx, args) => {
        await authorize(ctx, args);
        const campaigns = args.eventId
            ? await ctx.db
                  .query("campaigns")
                  .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
                  .order("desc")
                  .take(30)
            : await ctx.db.query("campaigns").order("desc").take(30);
        return {
            sending: await state(ctx),
            campaigns: campaigns.map((campaign) => {
                const { recipients, content: _content, ...values } = campaign;
                return {
                    ...values,
                    state: campaign.status[0].toUpperCase() + campaign.status.slice(1),
                    recipients: recipients?.length ?? 0,
                    accepted: campaign.accepted ?? 0,
                    delivered: campaign.delivered ?? 0,
                    failed: campaign.failed ?? 0,
                    skipped: campaign.skipped ?? 0,
                };
            }),
        };
    },
});

/** Preview exact saved content, current audience exclusions and recent message outcomes. */
export const preview = query({
    args: { id: v.id("campaigns") },
    handler: async (ctx, args) => {
        const campaign = await get(ctx, args.id);
        const viewer = await authorize(ctx, campaign);
        const selected = await select(ctx, campaign.audience!, campaign.category!);
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_campaign", (q) => q.eq("campaignId", args.id))
            .order("desc")
            .take(50);
        return {
            id: campaign._id,
            updatedAt: campaign.updatedAt,
            recipients: selected.recipients.length,
            excluded: selected.excluded,
            html: render(campaign).html,
            messages: messages.map((row) => ({
                id: row._id,
                to:
                    viewer.isAdmin || campaign.audience?.kind === "registrations"
                        ? row.to
                        : "Subscriber",
                status: row.status,
                isTest: !!row.isTest,
                outcome: row.outcome,
                error: row.error,
                attempts: row.attempts,
                nextAttemptAt: row.status === "queued" ? row.nextAttemptAt : undefined,
            })),
        };
    },
});

/** Edit drafts only; event organisers cannot address the global subscriber list. */
export const save = mutation({
    args: {
        id: v.optional(v.id("campaigns")),
        subject: v.string(),
        message: v.string(),
        audience: v.optional(audience),
    },
    handler: async (ctx, args) => {
        const selected = args.audience ?? { kind: "subscribers" as const };
        const eventId = selected.kind === "registrations" ? selected.eventId : undefined;
        const account = await authorize(ctx, { eventId });
        const subject = args.subject.trim();
        const message = args.message.trim();
        if (
            !subject ||
            subject.length > 160 ||
            /[\r\n]/.test(subject) ||
            !message ||
            message.length > 10000 ||
            message.includes("https://mail.invalid/")
        )
            throw new Error(
                "Enter a subject up to 160 characters and a message up to 10,000 characters.",
            );
        const existing = args.id ? await get(ctx, args.id) : null;
        if (
            existing &&
            (existing.status !== "draft" || existing.content || existing.eventId !== eventId)
        )
            throw new Error("Only written drafts in the same audience scope can be edited.");

        // keep category derived from scope rather than allowing privilege-changing intent flags
        const values = {
            subject,
            message,
            audience: selected,
            eventId,
            category: eventId ? ("update" as const) : ("campaign" as const),
            updatedAt: Date.now(),
        };
        if (existing) {
            await ctx.db.patch(existing._id, values);
            return existing._id;
        }
        return await ctx.db.insert("campaigns", {
            ...values,
            authorId: account._id,
            status: "draft",
            createdAt: Date.now(),
        });
    },
});

/** Freeze audience membership and its recency order exactly once when a campaign starts. */
async function start(ctx: MutationCtx, campaign: Doc<"campaigns">, recipients?: Recipient[]) {
    const selected = await byRecency(
        ctx,
        recipients ?? (await select(ctx, campaign.audience!, campaign.category!)).recipients,
    );
    if (selected.length > 10000) throw new Error("Campaign audience exceeds 10,000 recipients.");
    await ctx.db.patch(campaign._id, {
        recipients: selected,
        content: render(campaign),
        cursor: 0,
        status: selected.length ? "queued" : "completed",
        updatedAt: Date.now(),
    });
    if (selected.length)
        await ctx.scheduler.runAfter(0, internal.mail.campaigns.batch, {
            id: campaign._id,
        });
}

/** Confirm saved content and audience; scheduled audiences are frozen when due. */
export const queue = mutation({
    args: {
        id: v.id("campaigns"),
        expectedUpdatedAt: v.number(),
        expectedRecipients: v.number(),
        scheduledAt: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const campaign = await get(ctx, args.id);
        requireAudienceDelivery();
        const sending = await state(ctx);
        if (sending.isPaused || !sending.hasWebhook)
            throw new Error("Configure and enable bulk delivery first.");
        if (campaign.status !== "draft" || campaign.updatedAt !== args.expectedUpdatedAt)
            throw new Error("Campaign changed. Preview it again.");
        const selected = await select(ctx, campaign.audience!, campaign.category!);
        if (!selected.recipients.length || selected.recipients.length !== args.expectedRecipients)
            throw new Error("Recipient count changed. Preview it again.");
        if (
            args.scheduledAt !== undefined &&
            (!Number.isFinite(args.scheduledAt) || args.scheduledAt <= Date.now())
        )
            throw new Error("Choose a future send time.");

        const sender = await authorize(ctx, campaign);
        await ctx.db.patch(args.id, { authorId: sender._id });

        // freeze content at confirmation, and recipients at the actual send time
        if (args.scheduledAt)
            await ctx.db.patch(args.id, {
                status: "scheduled",
                scheduledAt: args.scheduledAt,
                content: render(campaign),
                updatedAt: Date.now(),
            });
        else await start(ctx, campaign, selected.recipients);
    },
});

/** Create one idempotent product campaign through the same durable message pipeline. */
export async function create(
    ctx: MutationCtx,
    values: {
        key: string;
        eventIds?: Id<"events">[];
        audience: Audience;
        category: Category;
        content: Content;
        eventId?: Id<"events">;
        seriesId?: Id<"series">;
        startsAt?: number;
        expiresAt?: number;
    },
    recipients?: Recipient[],
) {
    const existing = await ctx.db
        .query("campaigns")
        .withIndex("by_key", (q) => q.eq("key", values.key))
        .unique();
    if (existing) return existing._id;
    const id = await ctx.db.insert("campaigns", {
        ...values,
        subject: values.content.subject,
        message: values.content.text,
        status: "draft",
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });
    await start(ctx, (await ctx.db.get(id))!, recipients);
    return id;
}

/** Preserve product idempotency across manual triggers, automatic triggers and migration. */
function messageKey(campaign: Doc<"campaigns">, id: Recipient) {
    if (campaign.category === "reminder") return `reminder:${id}:${campaign.startsAt}`;
    if (campaign.category === "followup") return `followup:${id}`;
    return `${campaign.key ?? `campaign:${campaign._id}`}:${id}`;
}

/** Materialise bounded batches; consent is checked again immediately before delivery. */
export const batch = internalMutation({
    args: { id: v.id("campaigns") },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.id);
        if (!campaign || campaign.status !== "queued") return;
        const cursor = campaign.cursor ?? 0;
        const recipients = campaign.recipients!;
        let skipped = 0;
        for (const id of recipients.slice(cursor, cursor + 50)) {
            const key = messageKey(campaign, id);
            const existing = await ctx.db
                .query("messages")
                .withIndex("by_key", (q) => q.eq("key", key))
                .unique();
            const message = existing ? null : await personalize(ctx, campaign.content!, id);
            if (!message) {
                skipped++;
                continue;
            }
            await enqueue(
                ctx,
                key,
                message.to,
                message.subject,
                message.text,
                message.subscriptionId,
                0,
                message.html,
                {
                    campaignId: campaign._id,
                    category: campaign.category,
                    eventId: campaign.eventId,
                    registrationId: message.registrationId,
                    startsAt: campaign.startsAt,
                    expiresAt: campaign.expiresAt,
                    unsubscribeToken: message.unsubscribeToken,
                },
            );
        }
        const next = Math.min(cursor + 50, recipients.length);
        const finished = (campaign.finished ?? 0) + skipped;
        await ctx.db.patch(campaign._id, {
            cursor: next,
            skipped: (campaign.skipped ?? 0) + skipped,
            finished,
            ...(finished === recipients.length ? { status: "completed" as const } : {}),
        });
        if (next < recipients.length)
            await ctx.scheduler.runAfter(1000, internal.mail.campaigns.batch, args);
    },
});

/** Start scheduled campaigns only while sending is enabled. */
export const tick = internalMutation({
    args: {},
    handler: async (ctx) => {
        const sending = await state(ctx);
        if (sending.isLocked || sending.isPaused) return;
        const due = await ctx.db
            .query("campaigns")
            .withIndex("by_schedule", (q) =>
                q.eq("status", "scheduled").lte("scheduledAt", Date.now()),
            )
            .take(20);
        for (const campaign of due) {
            if (await canSend(ctx, campaign)) await start(ctx, campaign);
            else
                await ctx.db.patch(campaign._id, {
                    status: "paused",
                    pauseReason: "Sender access changed. Review before resuming.",
                });
        }
    },
});

/** Pause or resume without rebuilding the audience or resetting message attempts. */
export const pause = mutation({
    args: { id: v.id("campaigns"), isPaused: v.boolean() },
    handler: async (ctx, args) => {
        const campaign = await get(ctx, args.id);
        if (
            args.isPaused
                ? !["scheduled", "queued"].includes(campaign.status)
                : campaign.status !== "paused"
        )
            throw new Error("Campaign cannot change to that state.");
        if (!args.isPaused && recipientsLocked())
            throw new Error("Test recipient lock is enabled.");
        const status = args.isPaused ? "paused" : campaign.recipients ? "queued" : "scheduled";
        const account = await authorize(ctx, campaign);
        await ctx.db.patch(args.id, {
            status,
            updatedAt: Date.now(),
            pauseReason: undefined,
            ...(!args.isPaused ? { authorId: account._id } : {}),
        });
        if (status === "queued")
            await ctx.scheduler.runAfter(0, internal.mail.campaigns.batch, {
                id: args.id,
            });
    },
});

/** Stop unsent work; provider-accepted messages cannot be recalled. */
export const cancel = mutation({
    args: { id: v.id("campaigns") },
    handler: async (ctx, args) => {
        const campaign = await get(ctx, args.id);
        if (["completed", "cancelled"].includes(campaign.status))
            throw new Error("Campaign has already finished.");
        await ctx.db.patch(args.id, { status: "cancelled", updatedAt: Date.now() });
    },
});

/** Copy written content into a new editable draft without copying delivery history. */
export const duplicate = mutation({
    args: { id: v.id("campaigns") },
    handler: async (ctx, args) => {
        const campaign = await get(ctx, args.id);
        if (campaign.key)
            throw new Error("Automatic campaigns are created by their product action.");
        const account = await authorize(ctx, campaign);
        return await ctx.db.insert("campaigns", {
            subject: campaign.subject,
            message: campaign.message,
            audience: campaign.audience,
            category: campaign.category,
            eventId: campaign.eventId,
            authorId: account._id,
            status: "draft",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

/** Send a test only to the authenticated verified account, without advancing the campaign. */
export const test = mutation({
    args: { id: v.id("campaigns") },
    handler: async (ctx, args) => {
        const campaign = await get(ctx, args.id);
        const user = await authComponent.getAuthUser(ctx);
        if (!user?.emailVerified) throw new Error("Verify your email first.");
        if (!recipientAllowed(user.email))
            throw new Error("Your email is not in the test recipient allowlist.");
        await consumeLimit(ctx, `mail-test:${user._id}`, 5, 3600000, Date.now());
        const content = render(campaign);
        const registration = campaign.eventId
            ? await ctx.db
                  .query("registrations")
                  .withIndex("by_event", (q) => q.eq("eventId", campaign.eventId!))
                  .filter((q) => q.eq(q.field("email"), user.email))
                  .first()
            : null;
        const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_email", (q) => q.eq("email", user.email))
            .unique();
        const source = campaign.eventId ? registration : subscription;
        const needsLinks = Object.values(links).some(
            (link) => content.text.includes(link) || content.html?.includes(link),
        );
        if (!source && needsLinks)
            throw new Error(
                campaign.eventId
                    ? "Register for this event before testing its email."
                    : "Add your email as a subscriber before testing this email.",
            );
        const message = source ? await personalize(ctx, content, source._id) : content;
        if (!message) throw new Error("Test recipient is missing.");
        return await enqueue(
            ctx,
            `test:${campaign._id}:${crypto.randomUUID()}`,
            user.email,
            `[Test] ${message.subject}`,
            message.text,
            undefined,
            0,
            message.html,
            { campaignId: campaign._id, isTest: true },
        );
    },
});
