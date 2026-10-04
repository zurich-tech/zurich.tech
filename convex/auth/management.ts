import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "./access";

/** Load only when an administrator opens access management. */
export const list = query({
    args: {},
    handler: async (ctx) => {
        const viewer = await requireAdmin(ctx);
        const accounts = await ctx.db.query("accounts").collect();
        const grants = await ctx.db.query("accessGrants").collect();
        const people = await Promise.all(
            accounts
                .filter((a) => a.status === "active")
                .map(async (account) => {
                    const member = await ctx.db.get(account.memberId);
                    const emails = await ctx.db
                        .query("emails")
                        .withIndex("by_member", (query) => query.eq("memberId", account.memberId))
                        .collect();

                    return {
                        id: account._id,
                        name: member?.name ?? "Member",
                        emails: emails
                            .sort(
                                (a, b) =>
                                    Number(b.isPrimary) - Number(a.isPrimary) ||
                                    a.email.localeCompare(b.email),
                            )
                            .map((email) => email.email),
                        isAdmin: account.isAdmin,
                        isTeam: account.isTeam,
                        isMailSender: !!account.isMailSender,
                        isSelf: account._id === viewer._id,
                        grants: grants.filter((g) => g.accountId === account._id),
                    };
                }),
        );
        return {
            people: people.sort((a, b) => a.name.localeCompare(b.name)),
            events: (await ctx.db.query("events").collect())
                .sort((a, b) => b.startsAt - a.startsAt)
                .map((e) => ({ id: e._id, name: e.title })),
            series: (await ctx.db.query("series").collect()).map((s) => ({
                id: s._id,
                name: s.name,
            })),
        };
    },
});

/** Assign team or email authority explicitly and record who changed it. */
export const setPermission = mutation({
    args: {
        id: v.id("accounts"),
        permission: v.union(v.literal("isTeam"), v.literal("isMailSender")),
        isEnabled: v.boolean(),
    },
    handler: async (ctx, args) => {
        const viewer = await requireAdmin(ctx);
        const account = await ctx.db.get(args.id);
        if (!account || account.status !== "active") throw new ConvexError("Account not found.");

        // retain independent permissions and an attributable audit record
        await ctx.db.patch(args.id, { [args.permission]: args.isEnabled, updatedAt: Date.now() });
        await ctx.db.insert("accessChanges", {
            actorId: viewer._id,
            accountId: args.id,
            action: args.permission,
            detail: String(args.isEnabled),
            createdAt: Date.now(),
        });
    },
});

/** An administrator cannot remove their own access. */
export const setAdmin = mutation({
    args: { id: v.id("accounts"), isAdmin: v.boolean() },
    handler: async (ctx, args) => {
        const viewer = await requireAdmin(ctx);
        if (viewer._id === args.id)
            throw new ConvexError("You cannot change your own admin access.");
        const account = await ctx.db.get(args.id);
        if (!account || account.status !== "active") throw new ConvexError("Account not found.");
        await ctx.db.patch(args.id, { isAdmin: args.isAdmin, updatedAt: Date.now() });
        await ctx.db.insert("accessChanges", {
            actorId: viewer._id,
            accountId: args.id,
            action: "admin",
            detail: String(args.isAdmin),
            createdAt: Date.now(),
        });
    },
});

/** Update one explicit assignment, retaining an audit trail. */
export const setGrant = mutation({
    args: {
        accountId: v.id("accounts"),
        scope: v.union(
            v.object({ kind: v.literal("event"), id: v.id("events") }),
            v.object({ kind: v.literal("series"), id: v.id("series") }),
        ),
        role: v.union(v.literal("editor"), v.literal("organiser"), v.null()),
    },
    handler: async (ctx, args) => {
        const viewer = await requireAdmin(ctx);
        const account = await ctx.db.get(args.accountId);
        if (!account || account.status !== "active" || !(await ctx.db.get(args.scope.id)))
            throw new ConvexError("Account or scope not found.");
        const grants = await ctx.db
            .query("accessGrants")
            .withIndex("by_account", (q) => q.eq("accountId", args.accountId))
            .collect();
        const existing = grants.find(
            (g) => g.scope.kind === args.scope.kind && g.scope.id === args.scope.id,
        );
        if (args.role === null) {
            if (existing) await ctx.db.delete(existing._id);
        } else if (existing)
            await ctx.db.patch(existing._id, { role: args.role, updatedAt: Date.now() });
        else
            await ctx.db.insert("accessGrants", {
                accountId: args.accountId,
                scope: args.scope,
                role: args.role,
                updatedAt: Date.now(),
            });
        await ctx.db.insert("accessChanges", {
            actorId: viewer._id,
            accountId: args.accountId,
            action: "grant",
            detail: JSON.stringify({ scope: args.scope, role: args.role }),
            createdAt: Date.now(),
        });
    },
});
