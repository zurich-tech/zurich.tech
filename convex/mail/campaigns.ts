import { canSend } from "./access";
import { ConvexError, v } from "convex/values";
import {
    query,
    mutation,
    internalMutation,
    type QueryCtx,
    type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAdmin, requireMailSender } from "../auth/access";
import { allows } from "../auth/permissions";
import { permissions, requireEvent, requireSeries } from "../auth/grants";
import { authComponent } from "../auth/component";
import { campaignEmail, eventEmail } from "./templates";
import { activeSponsors } from "../sponsorships/organisations";
import { openJobs } from "../jobs/jobs";
import { readProgramme } from "./programme";
import { eventPlace } from "../events/place";
import { attribute } from "./referrals";
import { enqueue } from "./messages";
import {
    isBulk,
    recipientAllowed,
    recipientsLocked,
    requireAudienceDelivery,
    sendingDate,
} from "./policy";
import {
    audience,
    recipient,
    type Audience,
    type Category,
    type Content,
    type Recipient,
} from "./model";
import { rank, select } from "./audiences";
import { links, personalize } from "./personalization";
import { profileInvitation, profilePlaceholder } from "./involvement";
import { state } from "./sending";
import { consumeLimit } from "./limits";

/** Authorise against the stored scope, never a client-supplied replacement. */
async function authorize(
    ctx: QueryCtx,
    campaign: { eventId?: Id<"events">; seriesId?: Id<"series">; audience?: Audience },
    role: "editor" | "organiser" = "editor",
) {
    if (campaign.audience?.kind === "subscribers") return await requireAdmin(ctx);
    if (campaign.eventId) return await requireEvent(ctx, campaign.eventId, role);
    if (campaign.seriesId) return await requireSeries(ctx, campaign.seriesId, role);
    return await requireAdmin(ctx);
}

/** Load a campaign after checking its actual scope. */
async function get(ctx: QueryCtx, id: Id<"campaigns">) {
    const campaign = await ctx.db.get(id);
    if (!campaign) throw new ConvexError("Campaign not found.");
    await authorize(ctx, campaign);
    return campaign;
}

/** Render written content through the shared code template. */
async function render(campaign: Doc<"campaigns">, ctx: QueryCtx) {
    return (
        campaign.content ??
        campaignEmail(
            campaign,
            campaign.audience?.kind === "subscribers" ? links.unsubscribe : undefined,
            { sponsors: await activeSponsors(ctx), jobs: await openJobs(ctx) },
        )
    );
}

/** List scoped campaigns without exposing recipient identities or private links. */
export const list = query({
    args: { eventId: v.optional(v.id("events")) },
    handler: async (ctx, args) => {
        const viewer = await authorize(ctx, args);
        const campaigns = args.eventId
            ? await ctx.db
                  .query("campaigns")
                  .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
                  .order("desc")
                  .take(30)
            : await ctx.db.query("campaigns").order("desc").take(30);
        return {
            sending: await state(ctx),
            campaigns: campaigns
                .filter((campaign) => viewer.isAdmin || campaign.audience?.kind !== "subscribers")
                .map((campaign) => {
                    const { recipients, content: _content, ...values } = campaign;
                    return {
                        ...values,
                        isEditable:
                            campaign.status === "draft" &&
                            !campaign.content &&
                            !campaign.key &&
                            campaign.attemptLimit === undefined,
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
        const access = await permissions(ctx);
        const event = campaign.eventId ? await ctx.db.get(campaign.eventId) : null;
        const canInspectRecipients = allows(
            access,
            { eventId: campaign.eventId, seriesId: event?.seriesId ?? campaign.seriesId },
            "organiser",
        );
        const selected = await select(ctx, campaign.audience!, campaign.category!);

        // show administrators the exact draft order without exposing global addresses to organisers
        const ranked =
            viewer.isAdmin && (campaign.status === "draft" || campaign.attemptLimit !== undefined)
                ? await rank(
                      ctx,
                      selected.recipients.filter((id) => !campaign.recipients?.includes(id)),
                  )
                : undefined;
        const messages = canInspectRecipients
            ? await ctx.db
                  .query("messages")
                  .withIndex("by_campaign", (q) => q.eq("campaignId", args.id))
                  .order("desc")
                  .take(50)
            : [];
        const content = await render(campaign, ctx);

        return {
            id: campaign._id,
            updatedAt: campaign.updatedAt,
            recipients: selected.recipients.length,
            recipientIds:
                viewer.isAdmin && isBulk(campaign.category) ? selected.recipients : undefined,
            excluded: selected.excluded,
            audience: ranked
                ? {
                      cohorts: [0, 1, 2, 3].map(
                          (cohort) => ranked.filter((row) => row.cohort === cohort).length,
                      ),
                      first: ranked.slice(0, 100),
                  }
                : undefined,
            html: content.html?.replaceAll(
                profilePlaceholder.html,
                profileInvitation("create").html,
            ),
            subject: content.subject,
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

/** List published future events available for a reviewed announcement. */
export const announcements = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const events = await ctx.db
            .query("events")
            .withIndex("by_status_and_start", (q) =>
                q.eq("status", "scheduled").gt("startsAt", Date.now()),
            )
            .collect();
        return events
            .filter((event) => event.visibility !== "unlisted")
            .map((event) => ({ id: event._id, title: event.title, seriesId: event.seriesId }));
    },
});

/** Reject a second approved follow-up, allowing cancellation before any attempts. */
async function requireInvitation(ctx: QueryCtx, eventId: Id<"events">, id?: Id<"campaigns">) {
    const campaigns = await ctx.db
        .query("campaigns")
        .withIndex("by_event", (query) => query.eq("eventId", eventId))
        .collect();
    const previous = campaigns.some(
        (row) =>
            row._id !== id &&
            row.audience?.kind === "subscribers" &&
            row.audience.invitation &&
            ((row.attempts ?? 0) > 0 || (!!row.approval && row.status !== "cancelled")),
    );
    if (previous)
        throw new ConvexError("a follow-up invitation has already been approved for this event");
}

/** Count an invitation audience without creating a campaign or sending mail. */
export const invitationPreview = query({
    args: { eventId: v.id("events"), isFollowup: v.boolean() },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const event = await ctx.db.get(args.eventId);
        if (
            !event ||
            event.status !== "scheduled" ||
            event.startsAt <= Date.now() ||
            event.visibility === "unlisted"
        )
            throw new ConvexError("choose a published upcoming event");
        if (args.isFollowup && !event.seriesId) throw new ConvexError("this event has no series");
        if (args.isFollowup) await requireInvitation(ctx, event._id);
        const selected = await select(
            ctx,
            {
                kind: "subscribers",
                excludeEventId: event._id,
                seriesId: args.isFollowup ? event.seriesId : undefined,
                invitation: args.isFollowup ? "followup" : undefined,
            },
            "announcement",
        );

        return { recipients: selected.recipients.length, excluded: selected.excluded };
    },
});

/** Prepare the regular event template without scheduling or sending any messages. */
export const announcement = mutation({
    args: { eventId: v.id("events"), audience },
    handler: async (ctx, args) => {
        const account = await requireAdmin(ctx);
        const event = await ctx.db.get(args.eventId);
        if (
            !event ||
            event.status !== "scheduled" ||
            event.visibility === "unlisted" ||
            event.startsAt <= Date.now()
        )
            throw new ConvexError("Choose a published upcoming event.");
        if (args.audience.kind !== "subscribers" || args.audience.excludeEventId !== event._id)
            throw new ConvexError("Announcements must exclude existing event registrations.");
        // follow-up invitations always use the event's own historical series audience
        if (
            args.audience.invitation &&
            (!event.seriesId || args.audience.seriesId !== event.seriesId)
        )
            throw new ConvexError("follow-up invitations require this event's series");
        if (args.audience.invitation) await requireInvitation(ctx, event._id);
        if (
            args.audience.deliveredSince !== undefined &&
            (!Number.isFinite(args.audience.deliveredSince) ||
                args.audience.deliveredSince > Date.now())
        )
            throw new ConvexError("Choose a valid delivery history date.");

        // explain the registration history used to select follow-up recipients
        let description: string | undefined;
        if (args.audience.invitation && event.seriesId) {
            const series = await ctx.db.get(event.seriesId);
            if (!series) throw new ConvexError("event series is missing");
            description = `You previously signed up for ${series.name}. Here's the next event in the series, in case you missed it.`;
        }

        // render the invitation with its audience-specific introduction
        const content = eventEmail({ ...event, ...(await eventPlace(ctx, event)) }, "New event", {
            eventId: event._id,
            summary: true,
            programme: await readProgramme(ctx, event._id),
            sponsors: await activeSponsors(ctx),
            jobs: await openJobs(ctx),
            unsubscribeUrl: links.unsubscribe,
            subject: args.audience.invitation ? "Coming up" : undefined,
            description,
        });
        return await ctx.db.insert("campaigns", {
            audience: args.audience,
            eventId: event._id,
            seriesId: event.seriesId,
            category: "announcement",
            subject: content.subject,
            message: content.text,
            content,
            expiresAt: event.startsAt,
            authorId: account._id,
            status: "draft",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

/** Release the reviewed next recipients without changing global approval or pacing. */
export const release = mutation({
    args: {
        id: v.id("campaigns"),
        expectedUpdatedAt: v.number(),
        recipients: v.array(v.id("subscriptions")),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const campaign = await get(ctx, args.id);
        if (campaign.approval) throw new ConvexError("This campaign already has its own approval.");
        requireAudienceDelivery();
        const sending = await state(ctx);
        if (sending.isPaused || !sending.hasWebhook || sending.remaining <= 0)
            throw new ConvexError("Approve today's bulk allowance before releasing a batch.");
        if (
            campaign.attemptLimit === undefined ||
            !["draft", "completed"].includes(campaign.status) ||
            campaign.updatedAt !== args.expectedUpdatedAt
        )
            throw new ConvexError(
                "Campaign changed or its previous batch has not finished. Preview it again.",
            );
        if (campaign.expiresAt !== undefined && campaign.expiresAt <= Date.now())
            throw new ConvexError("This campaign has expired.");

        // require the same ordered identities, even when the eligible count has not changed
        const selected = await select(ctx, campaign.audience!, campaign.category!);
        const ranked = await rank(
            ctx,
            selected.recipients.filter((id) => !campaign.recipients?.includes(id)),
        );
        const next = ranked.slice(0, 100).map((row) => row.id);
        if (
            !next.length ||
            next.length !== args.recipients.length ||
            next.some((id, index) => id !== args.recipients[index])
        )
            throw new ConvexError("Recipient order changed. Preview the batch again.");
        if (sending.remaining < next.length)
            throw new ConvexError("Today's remaining allowance does not cover this batch.");

        // prevent a new shared allowance from accidentally reviving unrelated campaign work
        const others = await ctx.db.query("campaigns").collect();
        if (
            others.some(
                (row) =>
                    row._id !== campaign._id &&
                    ["queued", "scheduled"].includes(row.status) &&
                    ["campaign", "announcement", "weekly"].includes(row.category ?? ""),
            )
        )
            throw new ConvexError("Pause other bulk campaigns before releasing this batch.");
        const content = await attribute(await render(campaign, ctx), campaign, ctx);
        await ctx.db.patch(campaign._id, {
            recipients: [...(campaign.recipients ?? []), ...next],
            content,
            attemptLimit: (campaign.attempts ?? 0) + next.length,
            status: "queued",
            updatedAt: Date.now(),
        });
        await ctx.scheduler.runAfter(0, internal.mail.campaigns.batch, { id: campaign._id });
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
        if (selected.kind === "subscribers" && selected.invitation)
            throw new ConvexError("prepare follow-up invitations from the event invitation picker");
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
            throw new ConvexError(
                "Enter a subject up to 160 characters and a message up to 10,000 characters.",
            );
        const existing = args.id ? await get(ctx, args.id) : null;
        if (
            existing &&
            (existing.status !== "draft" || existing.content || existing.eventId !== eventId)
        )
            throw new ConvexError("Only written drafts in the same audience scope can be edited.");

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

/** Freeze audience membership and engagement order exactly once when a campaign starts. */
async function start(ctx: MutationCtx, campaign: Doc<"campaigns">, recipients?: Recipient[]) {
    // keep approved identities and order; transactional audiences are resolved when due
    const selected = campaign.approval
        ? campaign.recipients
        : (
              await rank(
                  ctx,
                  recipients ??
                      (await select(ctx, campaign.audience!, campaign.category!)).recipients,
              )
          ).map((row) => row.id);
    if (!selected) throw new Error("Approved campaign audience is missing.");
    if (selected.length > 10000)
        throw new ConvexError("Campaign audience exceeds 10,000 recipients.");

    // register shared attribution links before freezing content and personalising messages
    const content = await attribute(await render(campaign, ctx), campaign, ctx);
    await ctx.db.patch(campaign._id, {
        recipients: selected,
        content,
        cursor: 0,
        status: selected.length ? "queued" : "completed",
        updatedAt: Date.now(),
    });
    if (selected.length)
        await ctx.scheduler.runAfter(0, internal.mail.campaigns.batch, {
            id: campaign._id,
        });
}

/** Approve saved content and a bounded subscriber audience for one sending day. */
export const queue = mutation({
    args: {
        id: v.id("campaigns"),
        expectedUpdatedAt: v.number(),
        expectedRecipients: v.number(),
        expectedRecipientIds: v.optional(v.array(recipient)),
        scheduledAt: v.optional(v.number()),
        hourlyLimit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const campaign = await get(ctx, args.id);
        await authorize(ctx, campaign, "organiser");
        await requireMailSender(ctx);
        requireAudienceDelivery();
        // never turn an old, partially sent batch into a fresh campaign approval
        if (
            campaign.approval ||
            campaign.recipients !== undefined ||
            campaign.reviewedBatch ||
            (campaign.attempts ?? 0) > 0 ||
            (campaign.attemptLimit ?? 0) > 0
        )
            throw new ConvexError("This campaign has already been released. Create a new draft.");
        const sending = await state(ctx);
        if (sending.isPaused || !sending.hasWebhook)
            throw new ConvexError("Configure and enable bulk delivery first.");
        if (campaign.status !== "draft" || campaign.updatedAt !== args.expectedUpdatedAt)
            throw new ConvexError("Campaign changed. Preview it again.");
        const selected = await select(ctx, campaign.audience!, campaign.category!);
        if (!selected.recipients.length || selected.recipients.length !== args.expectedRecipients)
            throw new ConvexError("Recipient count changed. Preview it again.");
        // claim at most one follow-up campaign per event, atomically with approval
        if (campaign.audience?.kind === "subscribers" && campaign.audience.invitation) {
            const event = campaign.eventId ? await ctx.db.get(campaign.eventId) : null;
            if (
                !event ||
                event.status !== "scheduled" ||
                event.startsAt <= Date.now() ||
                event.visibility === "unlisted" ||
                !event.seriesId ||
                campaign.audience.seriesId !== event.seriesId ||
                campaign.audience.excludeEventId !== event._id
            )
                throw new ConvexError("event changed: prepare the invitation again");
            await requireInvitation(ctx, campaign.eventId!, campaign._id);
        }
        if (
            args.scheduledAt !== undefined &&
            (!Number.isFinite(args.scheduledAt) || args.scheduledAt <= Date.now())
        )
            throw new ConvexError("Choose a future send time.");

        const sender = await authorize(ctx, campaign);
        const now = Date.now();
        const sendAt = args.scheduledAt ?? now;
        if (campaign.expiresAt !== undefined && sendAt >= campaign.expiresAt)
            throw new ConvexError("Choose a send time before the campaign expires.");

        // approve bulk mail independently from the legacy shared daily allowance
        if (isBulk(campaign.category)) {
            await requireAdmin(ctx);
            if (
                !args.expectedRecipientIds ||
                args.expectedRecipientIds.length !== selected.recipients.length ||
                selected.recipients.some((id, index) => id !== args.expectedRecipientIds![index])
            )
                throw new ConvexError("Recipients changed. Preview the campaign again.");
            if (
                !Number.isInteger(args.hourlyLimit) ||
                args.hourlyLimit! < 1 ||
                args.hourlyLimit! > sending.limits.hourly
            )
                throw new ConvexError(`Choose an hourly limit from 1 to ${sending.limits.hourly}.`);
            if (selected.recipients.length > sending.limits.daily)
                throw new ConvexError("The audience exceeds the shared daily limit.");

            // freeze identities and content now; new subscribers need a separate approval
            const ranked = await rank(ctx, selected.recipients);
            const values = {
                authorId: sender._id,
                approval: {
                    date: sendingDate(sendAt),
                    limit: ranked.length,
                    hourlyLimit: args.hourlyLimit!,
                    approvedAt: now,
                    approvedBy: sender._id,
                },
                attemptLimit: ranked.length,
                attempts: 0,
                scheduledAt: sendAt,
                recipients: ranked.map((row) => row.id),
                content: await render(campaign, ctx),
                status: "scheduled" as const,
                updatedAt: now,
            };
            await ctx.db.patch(args.id, values);
            if (args.scheduledAt === undefined)
                await start(ctx, { ...campaign, ...values }, values.recipients);

            return;
        }

        // preserve the existing event-organiser workflow for transactional messages
        if (args.hourlyLimit !== undefined)
            throw new ConvexError("Hourly limits apply only to subscriber campaigns.");
        await ctx.db.patch(args.id, { authorId: sender._id });

        // freeze content at confirmation, and recipients at the actual send time
        if (args.scheduledAt)
            await ctx.db.patch(args.id, {
                status: "scheduled",
                scheduledAt: args.scheduledAt,
                content: await render(campaign, ctx),
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
        const now = Date.now();
        const date = sendingDate(now);
        // expire approvals even while global delivery is paused
        for (const status of ["scheduled", "queued"] as const) {
            const campaigns = await ctx.db
                .query("campaigns")
                .withIndex("by_schedule", (q) => q.eq("status", status))
                .collect();
            for (const campaign of campaigns) {
                if (campaign.approval && campaign.approval.date < date)
                    await ctx.db.patch(campaign._id, {
                        status: "paused",
                        pauseReason:
                            "Campaign approval expired at Zurich midnight. Review unsent recipients in a new campaign.",
                        updatedAt: now,
                    });
            }
        }
        const sending = await state(ctx);
        if (sending.isLocked || sending.isPaused) return;
        const due = await ctx.db
            .query("campaigns")
            .withIndex("by_schedule", (q) =>
                q.eq("status", "scheduled").lte("scheduledAt", Date.now()),
            )
            .take(20);
        for (const campaign of due) {
            if (await canSend(ctx, campaign))
                await start(ctx, campaign, campaign.approval ? campaign.recipients : undefined);
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
        await authorize(ctx, campaign, "organiser");
        if (!args.isPaused) await requireMailSender(ctx);
        if (
            args.isPaused
                ? !["scheduled", "queued"].includes(campaign.status)
                : campaign.status !== "paused"
        )
            throw new ConvexError("Campaign cannot change to that state.");
        if (!args.isPaused && recipientsLocked())
            throw new ConvexError("Test recipient lock is enabled.");
        if (!args.isPaused && campaign.approval && campaign.approval.date < sendingDate(Date.now()))
            throw new ConvexError(
                "Campaign approval expired. Review unsent recipients in a new campaign.",
            );
        const hasStarted = campaign.approval
            ? campaign.cursor !== undefined
            : !!campaign.recipients;
        const status = args.isPaused ? "paused" : hasStarted ? "queued" : "scheduled";
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
        await authorize(ctx, campaign, "organiser");
        if (["completed", "cancelled"].includes(campaign.status))
            throw new ConvexError("Campaign has already finished.");
        await ctx.db.patch(args.id, { status: "cancelled", updatedAt: Date.now() });
    },
});

/** Copy written content into a new editable draft without copying delivery history. */
export const duplicate = mutation({
    args: { id: v.id("campaigns") },
    handler: async (ctx, args) => {
        const campaign = await get(ctx, args.id);
        if (
            campaign.key ||
            campaign.category === "announcement" ||
            (campaign.attemptLimit !== undefined && !campaign.approval)
        )
            throw new ConvexError("Automatic campaigns are created by their product action.");
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
        await authorize(ctx, campaign, "organiser");
        await requireMailSender(ctx);
        const user = await authComponent.getAuthUser(ctx);
        if (!user?.emailVerified) throw new ConvexError("Verify your email first.");
        if (!recipientAllowed(user.email))
            throw new ConvexError("Your email is not in the test recipient allowlist.");
        await consumeLimit(ctx, `mail-test:${user._id}`, 5, 3600000, Date.now());
        const content = await render(campaign, ctx);
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
        const source = campaign.audience?.kind === "registrations" ? registration : subscription;
        const needsLinks =
            content.text.includes(profilePlaceholder.text) ||
            Object.values(links).some(
                (link) => content.text.includes(link) || content.html?.includes(link),
            );
        if (!source && needsLinks)
            throw new ConvexError(
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
