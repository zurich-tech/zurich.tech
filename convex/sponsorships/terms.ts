import { refreshRecognition } from "./recognition";
import { contribution } from "./contributions";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, internalMutation, type MutationCtx, type QueryCtx } from "../_generated/server";
import { requireAdmin } from "../auth/access";
import { requireCheckoutClosed } from "../billing/checkouts";
import { tier } from "../billing/purchases";

/** Dates use an exclusive end; publication may precede the benefit period. */
export const termFields = {
    sponsorshipId: v.id("sponsorships"),
    tier,
    contribution,
    startsAt: v.number(),
    endsAt: v.number(),
    publishedAt: v.optional(v.number()),
    reason: v.string(),
};

/** Read retained terms in their effective order. */
export async function readTerms(ctx: Pick<QueryCtx, "db">, sponsorshipId: Id<"sponsorships">) {
    return await ctx.db
        .query("sponsorshipTerms")
        .withIndex("by_sponsorship", (q) => q.eq("sponsorshipId", sponsorshipId))
        .collect();
}

/** Select current benefits or public recognition without consulting payments. */
export function selectTerm(terms: Doc<"sponsorshipTerms">[], now: number, recognition = false) {
    return (
        terms
            .filter(
                (term) =>
                    !term.supersededAt &&
                    (recognition
                        ? term.publishedAt !== undefined && term.publishedAt <= now
                        : term.startsAt <= now) &&
                    Math.min(term.endsAt, term.endedAt ?? Infinity) > now,
            )
            .sort((a, b) => {
                // retain the current tier until a future renewal begins
                const aStarted = a.startsAt <= now,
                    bStarted = b.startsAt <= now;
                if (aStarted !== bStarted) return aStarted ? -1 : 1;
                return aStarted ? b.startsAt - a.startsAt : a.startsAt - b.startsAt;
            })[0] ?? null
    );
}

/** Agree a new term or replace a term while retaining its previous version. */
export const agree = mutation({
    args: { ...termFields, replacesId: v.optional(v.id("sponsorshipTerms")) },
    handler: async (ctx, args) => {
        const reviewer = await requireAdmin(ctx);
        return await agreeTerm(ctx, args, reviewer.memberId);
    },
});

/** Apply a reviewed agreement through the administrative CLI. */
export const record = internalMutation({
    args: {
        ...termFields,
        replacesId: v.optional(v.id("sponsorshipTerms")),
        recordedBy: v.id("members"),
    },
    handler: async (ctx, { recordedBy, ...args }) => agreeTerm(ctx, args, recordedBy),
});

/** Persist agreement dates and audit metadata without creating a payment. */
export async function agreeTerm(
    ctx: MutationCtx,
    args: {
        sponsorshipId: Id<"sponsorships">;
        tier: "bronze" | "silver" | "gold";
        contribution: { kind: "money"; amount: number } | { kind: "inKind"; description: string };
        startsAt: number;
        endsAt: number;
        publishedAt?: number;
        reason: string;
        replacesId?: Id<"sponsorshipTerms">;
    },
    recordedBy: Id<"members">,
) {
    // validate the company, dates and contribution before changing any records
    const sponsor = await ctx.db.get(args.sponsorshipId);
    if (!sponsor || !("organisationId" in sponsor))
        throw new ConvexError("Company sponsorship not found.");
    if (!(await ctx.db.get(recordedBy))) throw new Error("Recording member not found.");
    if (
        ![args.startsAt, args.endsAt, args.publishedAt ?? 0].every(Number.isFinite) ||
        args.endsAt <= args.startsAt ||
        (args.publishedAt !== undefined && args.publishedAt >= args.endsAt)
    )
        throw new ConvexError("Enter valid agreement and publication dates.");
    if (!args.reason.trim()) throw new ConvexError("Explain the agreement or change.");
    if (
        args.contribution.kind === "money" &&
        (!Number.isFinite(args.contribution.amount) ||
            args.contribution.amount <= 0 ||
            !Number.isSafeInteger(Math.round(args.contribution.amount * 100)) ||
            Math.abs(args.contribution.amount * 100 - Math.round(args.contribution.amount * 100)) >
                0.00001)
    )
        throw new ConvexError("Enter a positive CHF amount with at most two decimals.");
    if (args.contribution.kind === "inKind" && !args.contribution.description.trim())
        throw new ConvexError("Describe the in-kind contribution.");
    await requireCheckoutClosed(ctx, sponsor._id);

    // retain prior versions and reject overlapping benefit periods
    const terms = await readTerms(ctx, sponsor._id);
    const previous = args.replacesId
        ? terms.find((term) => term._id === args.replacesId)
        : undefined;
    if (args.replacesId && (!previous || previous.supersededAt || previous.endedAt !== undefined))
        throw new ConvexError("Select a current term to amend.");
    for (const term of terms) {
        if (
            term._id !== args.replacesId &&
            !term.supersededAt &&
            args.startsAt < Math.min(term.endsAt, term.endedAt ?? Infinity) &&
            args.endsAt > term.startsAt
        )
            throw new ConvexError(
                "Agreement dates overlap an existing term. Amend that term or choose a later start.",
            );
    }
    const now = Date.now();
    if (previous) await ctx.db.patch(previous._id, { supersededAt: now });
    const id = await ctx.db.insert("sponsorshipTerms", {
        ...args,
        reason: args.reason.trim(),
        recordedBy,
        createdAt: now,
    });
    await ctx.db.patch(sponsor._id, {
        status: "active",
        isRenewalRequested: false,
        updatedAt: now,
    });

    await refreshRecognition(ctx, sponsor._id);
    return id;
}

/** End a term without rewriting its agreed dates or its invoices. */
export const end = mutation({
    args: { id: v.id("sponsorshipTerms"), endedAt: v.number(), reason: v.string() },
    handler: async (ctx, args) => {
        const reviewer = await requireAdmin(ctx);
        const term = await ctx.db.get(args.id);
        if (!term || term.supersededAt || term.endedAt !== undefined)
            throw new ConvexError("Select an open agreement.");
        if (!Number.isFinite(args.endedAt) || args.endedAt > term.endsAt || !args.reason.trim())
            throw new ConvexError("Enter an end date and reason.");
        await requireCheckoutClosed(ctx, term.sponsorshipId);
        await ctx.db.patch(term._id, {
            endedAt: args.endedAt,
            endedBy: reviewer.memberId,
            endReason: args.reason.trim(),
            endedRecordedAt: Date.now(),
        });
        await refreshRecognition(ctx, term.sponsorshipId);
    },
});
