import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { authComponent } from "./component";
import type { QueryCtx, MutationCtx } from "../_generated/server";

/** Require an active account. */
export async function requireAccount(ctx: QueryCtx | MutationCtx) {
    // resolve the signed in account before reading its privileges
    const user = await authComponent.getAuthUser(ctx);
    const record = await ctx.db
        .query("accounts")
        .withIndex("by_auth", (range) => range.eq("authId", user._id))
        .unique();
    if (record === null || record.status !== "active")
        throw new Error("An active account is required.");

    return record;
}

/** Require shared team access. */
export async function requireTeam(ctx: QueryCtx | MutationCtx) {
    const viewer = await requireAccount(ctx);
    if (!viewer.isTeam) throw new Error("Team access is required.");

    return viewer;
}

/** Grant or revoke team access for another signed-in account. */
export const setTeam = mutation({
    args: { id: v.id("accounts"), isTeam: v.boolean() },
    handler: async (ctx, args) => {
        const viewer = await requireTeam(ctx);
        if (viewer._id === args.id) throw new Error("You cannot change your own team access.");
        const account = await ctx.db.get(args.id);
        if (!account || account.status !== "active")
            throw new Error("An active account is required.");

        // keep administrative access independent of public team titles
        await ctx.db.patch(args.id, { isTeam: args.isTeam, updatedAt: Date.now() });
    },
});

/** Grant initial team membership through the authenticated deployment CLI. */
export const grantTeam = internalMutation({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        // find the member through their signed in email
        const email = await ctx.db
            .query("emails")
            .withIndex("by_email", (range) => range.eq("email", args.email.trim().toLowerCase()))
            .unique();
        if (!email) throw new Error("Sign in once before granting team access.");
        // Grant administrative access without changing public titles.
        const account = await ctx.db
            .query("accounts")
            .withIndex("by_member", (q) => q.eq("memberId", email.memberId))
            .unique();
        if (!account) throw new Error("Sign in once before granting team access.");
        await ctx.db.patch(account._id, { isTeam: true, updatedAt: Date.now() });
    },
});
