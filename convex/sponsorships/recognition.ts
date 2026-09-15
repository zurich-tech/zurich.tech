import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { paidTerm } from "../billing/payments";
import { readTerms, selectTerm } from "./terms";

/** Materialise public recognition and schedule its next date transition. */
export async function refreshRecognition(ctx: MutationCtx, id: Id<"sponsorships">) {
    const sponsor = await ctx.db.get(id);
    if (!sponsor) return;
    const now = Date.now();
    const terms = "organisationId" in sponsor ? await readTerms(ctx, id) : [];
    const paid = "memberId" in sponsor ? await paidTerm(ctx, id) : null;
    const current =
        "organisationId" in sponsor
            ? selectTerm(terms, now, true)?.tier
            : paid && paid.startsAt <= now && paid.endsAt > now
              ? sponsor.tier
              : undefined;
    const dates = paid
        ? [paid.startsAt, paid.endsAt]
        : terms
              .filter((term) => !term.supersededAt)
              .flatMap((term) => [
                  term.publishedAt,
                  term.startsAt,
                  Math.min(term.endsAt, term.endedAt ?? Infinity),
              ]);
    const next = dates
        .filter((date): date is number => date !== undefined && date > now)
        .sort((a, b) => a - b)[0];
    await ctx.db.patch(id, { recognition: current, recognitionAt: next });

    // unchanged dates retain their existing task; superseded tasks become harmless no-ops
    if (next !== undefined && next !== sponsor.recognitionAt)
        await ctx.scheduler.runAt(next, internal.sponsorships.recognition.advance, {
            id,
            at: next,
        });
}

/** Advance only the current scheduled transition, never a superseded agreement's task. */
export const advance = internalMutation({
    args: { id: v.id("sponsorships"), at: v.number() },
    handler: async (ctx, { id, at }) => {
        const sponsor = await ctx.db.get(id);
        if (sponsor?.recognitionAt === at && at <= Date.now()) await refreshRecognition(ctx, id);
    },
});

/** Initialise recognition and scheduled transitions for existing agreements. */
export const rebuild = internalMutation({
    args: {},
    handler: async (ctx) => {
        const rows = await ctx.db.query("sponsorships").collect();
        for (const row of rows) await refreshRecognition(ctx, row._id);
        return { sponsorships: rows.length };
    },
});
