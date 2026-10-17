import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

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
