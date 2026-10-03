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

/** Require administrative authority, independently of team content access. */
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
    const account = await requireAccount(ctx);
    if (!account.isAdmin) throw new Error("Admin access is required.");
    return account;
}

/** Require team content management without granting administrative authority. */
export async function requireTeam(ctx: QueryCtx | MutationCtx) {
    const account = await requireAccount(ctx);
    if (!account.isAdmin && !account.isTeam) throw new Error("Team access is required.");

    return account;
}

/** Require explicit email authority independently of event and content assignments. */
export async function requireMailSender(ctx: QueryCtx | MutationCtx) {
    const account = await requireAccount(ctx);
    if (!account.isAdmin && !account.isMailSender)
        throw new Error("Email sending permission is required.");

    return account;
}
