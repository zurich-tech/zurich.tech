import { paidTerm } from "./payments";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAccount } from "./access";

/** List current patrons who opted into public recognition. */
export const list = query({
    args: {},
    handler: async (ctx) => {
        // read only current terms and disclose opted in identities
        const rows = await ctx.db.query("patrons").collect();
        const patrons = await Promise.all(
            rows
                .filter((row) => row.isPublic)
                .map(async (row) => {
                    const term = await paidTerm(ctx, row.memberId);
                    if (!term || term.endsAt <= Date.now()) return null;
                    const member = await ctx.db.get(row.memberId);
                    if (!member) throw new Error("Patron member is missing.");

                    return member.status === "active"
                        ? { id: row._id, name: member.name, avatarUrl: member.avatarUrl }
                        : null;
                }),
        );

        return patrons.filter((patron) => patron !== null);
    },
});

/** Read the signed in member's patron term and visibility. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        const viewer = await requireAccount(ctx);

        const patron = await ctx.db
            .query("patrons")
            .withIndex("by_member", (q) => q.eq("memberId", viewer.memberId))
            .unique();
        const term = await paidTerm(ctx, viewer.memberId);

        return patron && term ? { ...patron, ...term } : null;
    },
});

/** Let a patron choose whether their name and avatar appear publicly. */
export const setVisibility = mutation({
    args: { isPublic: v.boolean() },
    handler: async (ctx, args) => {
        const viewer = await requireAccount(ctx);
        const patron = await ctx.db
            .query("patrons")
            .withIndex("by_member", (q) => q.eq("memberId", viewer.memberId))
            .unique();
        if (!patron) throw new Error("Patron membership not found.");
        await ctx.db.patch(patron._id, { isPublic: args.isPublic });
    },
});
