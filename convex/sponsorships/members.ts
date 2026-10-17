import { readProfiles } from "../members/links";
import type { Doc } from "../_generated/dataModel";
import { paidTerm } from "../billing/coverage";
import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireAccount } from "../auth/access";

/** List current personal sponsors who opted into public recognition. */
export const list = query({
    args: {},
    handler: async (ctx) => {
        // read only current terms and disclose opted in identities
        const rows = await ctx.db.query("sponsorships").collect();
        const patrons = await Promise.all(
            rows
                .filter(
                    (row): row is Extract<Doc<"sponsorships">, { memberId: unknown }> =>
                        "memberId" in row &&
                        row.isPublic &&
                        row.status === "active" &&
                        row.recognition === "friend",
                )
                .map(async (row) => {
                    const member = await ctx.db.get(row.memberId);
                    if (!member) throw new Error("Sponsor member is missing.");

                    return member.status === "active"
                        ? {
                              id: row._id,
                              tier: row.tier,
                              name: member.name,
                              headline: member.headline,
                              avatarUrl: member.avatarUrl,
                              avatarDarkUrl: member.avatarDarkUrl,
                              profileUrl: (await readProfiles(ctx, member._id)).profileUrl,
                          }
                        : null;
                }),
        );

        return patrons.filter((patron) => patron !== null);
    },
});

/** Read the signed in member's support term and visibility. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        const viewer = await requireAccount(ctx);

        const patron = await ctx.db
            .query("sponsorships")
            .withIndex("by_member", (q) => q.eq("memberId", viewer.memberId))
            .unique();
        const term = patron ? await paidTerm(ctx, patron._id) : null;

        return patron && term ? { ...patron, ...term } : null;
    },
});

/** Let a member choose whether their name and avatar appear publicly. */
export const setVisibility = mutation({
    args: { isPublic: v.boolean() },
    handler: async (ctx, args) => {
        const viewer = await requireAccount(ctx);
        const patron = await ctx.db
            .query("sponsorships")
            .withIndex("by_member", (q) => q.eq("memberId", viewer.memberId))
            .unique();
        if (!patron) throw new ConvexError("Support plan not found.");
        await ctx.db.patch(patron._id, { isPublic: args.isPublic });
    },
});
