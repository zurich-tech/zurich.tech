import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
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

/** Grant initial administrative access through the authenticated deployment CLI. */
export const grantAdmin = internalMutation({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        // find the member through their signed in email
        const email = await ctx.db
            .query("emails")
            .withIndex("by_email", (range) => range.eq("email", args.email.trim().toLowerCase()))
            .unique();
        if (!email) throw new Error("Sign in once before granting admin access.");
        // Grant administrative access without changing public titles.
        const account = await ctx.db
            .query("accounts")
            .withIndex("by_member", (q) => q.eq("memberId", email.memberId))
            .unique();
        if (!account) throw new Error("Sign in once before granting admin access.");
        await ctx.db.patch(account._id, { isAdmin: true, updatedAt: Date.now() });
    },
});

/** Require explicit global authority; public team membership is not a permission. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
    const account = await requireAccount(ctx);
    if (!account.isAdmin) throw new Error("Admin access is required.");
    return account;
}
