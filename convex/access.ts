import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";
import { authComponent } from "./auth/component";
import type { QueryCtx, MutationCtx } from "./_generated/server";

/** Require an active account and its explicit publishing privileges. */
export async function requireAccount(ctx: QueryCtx | MutationCtx) {
    // resolve the signed in account before reading its privileges
    const user = await authComponent.getAuthUser(ctx);
    const record = await ctx.db
        .query("accounts")
        .withIndex("by_authId", (range) => range.eq("authId", user._id))
        .unique();
    if (record === null || record.status !== "active")
        throw new Error("An active account is required.");

    // combine explicit publishing access with team membership
    const roles = await ctx.db
        .query("memberRoles")
        .withIndex("by_memberId", (range) => range.eq("memberId", record.memberId))
        .collect();
    const isTeam = roles.some((role) => role.role === "team");

    return { ...record, isTeam, canPublish: isTeam || record.canPublish === true };
}

/** Require shared team access. */
export async function requireTeam(ctx: QueryCtx | MutationCtx) {
    const viewer = await requireAccount(ctx);
    if (!viewer.isTeam) throw new Error("Team access is required.");

    return viewer;
}

/** Grant or revoke the ability to publish one's own events. */
export const setPublishingAccess = mutation({
    args: { id: v.id("accounts"), canPublish: v.boolean() },
    handler: async (ctx, args) => {
        await requireTeam(ctx);
        await ctx.db.patch(args.id, { canPublish: args.canPublish, updatedAt: Date.now() });
    },
});

/** Grant initial team membership through the authenticated deployment CLI. */
export const grantTeam = internalMutation({
    args: { email: v.string() },
    handler: async (ctx, args) => {
        // find the member through their signed in email
        const email = await ctx.db
            .query("memberEmails")
            .withIndex("by_email", (range) => range.eq("email", args.email.trim().toLowerCase()))
            .unique();
        if (!email) throw new Error("Sign in once before granting team access.");
        // insert team membership only when absent
        const roles = await ctx.db
            .query("memberRoles")
            .withIndex("by_memberId", (range) => range.eq("memberId", email.memberId))
            .collect();
        if (!roles.some((role) => role.role === "team"))
            await ctx.db.insert("memberRoles", {
                memberId: email.memberId,
                role: "team",
                createdAt: Date.now(),
            });
    },
});
