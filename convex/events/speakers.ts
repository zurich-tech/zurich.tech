import { requireAccount } from "../auth/access";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireTeam } from "../auth/access";
/** Find member profiles for a team-authored speaking appearance. */
export const members = query({
    args: { search: v.string() },
    handler: async (ctx, args) => {
        await requireTeam(ctx);
        if (args.search.trim().length < 2) return [];
        const rows = await ctx.db
            .query("members")
            .withSearchIndex("search_text", (q) => q.search("searchText", args.search.trim()))
            .take(15);
        return rows
            .filter((row) => row.status !== "deleted" && row.status !== "blocked")
            .map((row) => ({ id: row._id, name: row.name, title: row.headline }));
    },
});

/** Identify speaking experience without granting team permissions. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        const account = await requireAccount(ctx);
        return !!(await ctx.db
            .query("speakers")
            .withIndex("by_member", (q) => q.eq("memberId", account.memberId))
            .first());
    },
});
