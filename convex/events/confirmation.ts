import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { requireEvent } from "../auth/grants";
import { requireMailSender } from "../auth/access";
import { confirmAction, eventAction } from "./actions";
import { confirmationDecision, isTentative } from "./conditions";

/** Commit a final outcome and schedule bounded attendee notifications atomically. */
export async function settle(
    ctx: MutationCtx,
    event: Doc<"events">,
    outcome: "confirmed" | "cancelled",
    description?: string,
) {
    const now = Date.now();
    await ctx.db.patch(
        event._id,
        outcome === "confirmed"
            ? { confirmedAt: now, updatedAt: now }
            : { status: "cancelled", updatedAt: now },
    );
    await ctx.scheduler.runAfter(0, internal.mail.events.outcome, {
        eventId: event._id,
        outcome,
        description,
        cursor: null,
    });
}

/** Evaluate only published tentative events; a confirmed outcome never regresses. */
export async function evaluate(ctx: MutationCtx, event: Doc<"events">) {
    const current = await ctx.db.get(event._id);
    if (!current || current.status !== "scheduled" || !isTentative(current)) return;
    const rows = await ctx.db
        .query("registrations")
        .withIndex("by_event", (q) => q.eq("eventId", event._id))
        .collect();
    const outcome =
        current.startsAt <= Date.now()
            ? "cancelled"
            : confirmationDecision(current, rows, Date.now());
    if (outcome)
        await settle(
            ctx,
            current,
            outcome,
            outcome === "cancelled" ? "The event wasn’t confirmed by its deadline." : undefined,
        );
}

/** Schedule the exact deadline and immediately evaluate newly satisfied requirements. */
export async function scheduleDecision(ctx: MutationCtx, event: Doc<"events">) {
    if (!isTentative(event) || event.status !== "scheduled") return;
    await ctx.scheduler.runAt(
        Math.max(Date.now(), event.confirmation!.decidesAt),
        internal.events.confirmation.check,
        { eventId: event._id },
    );
    await evaluate(ctx, event);
}

/** Re-read the current deadline so stale scheduled jobs cannot apply old rules. */
export const check = internalMutation({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (event) await evaluate(ctx, event);
    },
});

/** Recover pending decisions after interrupted scheduling or deployment. */
export const tick = internalMutation({
    args: {},
    handler: async (ctx) => {
        const events = await ctx.db
            .query("events")
            .withIndex("by_status_and_start", (q) => q.eq("status", "scheduled"))
            .collect();
        for (const event of events)
            if (isTentative(event))
                await ctx.scheduler.runAfter(0, internal.events.confirmation.check, {
                    eventId: event._id,
                });
    },
});

/** Approve the manual requirement or explicitly override all remaining requirements. */
export const decide = mutation({
    args: {
        eventId: v.id("events"),
        action: v.union(v.literal("approve"), v.literal("confirm")),
        receipt: v.string(),
    },
    handler: async (ctx, args) => {
        await requireEvent(ctx, args.eventId);
        await requireMailSender(ctx);
        const event = await ctx.db.get(args.eventId);
        if (
            !event ||
            event.status !== "scheduled" ||
            event.startsAt <= Date.now() ||
            !isTentative(event)
        )
            throw new ConvexError("This event is not awaiting confirmation.");
        confirmAction(await eventAction(ctx, event, args.action), args.receipt);
        if (args.action === "confirm") await settle(ctx, event, "confirmed");
        else {
            if (!event.confirmation!.isApprovalRequired)
                throw new ConvexError("This event does not require team approval.");
            if (event.confirmation!.decidesAt <= Date.now())
                throw new ConvexError("The approval deadline has passed.");
            const approvedAt = Date.now();
            await ctx.db.patch(event._id, { approvedAt, updatedAt: approvedAt });
            await evaluate(ctx, { ...event, approvedAt });
        }
    },
});
