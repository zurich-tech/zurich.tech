import { createClient, type AuthFunctions } from "@convex-dev/better-auth";
import { components, internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { normalizeEmail } from "../members/emails";
import { createMember, claimMember } from "./member";

/** Internal functions invoked by authentication triggers. */
const authFunctions: AuthFunctions = internal.auth.index;

/** Better Auth component bound to local member records. */
export const authComponent = createClient<DataModel>(components.betterAuth, {
    authFunctions,
    triggers: {
        user: {
            onCreate: async (ctx, user) => {
                const now = Date.now();
                const address = normalizeEmail(user.email);

                // require verified ownership before claiming imported records
                if (!user.emailVerified) {
                    throw new Error("A verified email is required.");
                }

                // reject duplicate auth identities
                const account = await ctx.db
                    .query("accounts")
                    .withIndex("by_auth", (query) => query.eq("authId", user._id))
                    .unique();
                if (account !== null) {
                    throw new Error(`Account already exists for auth user ${user._id}.`);
                }

                // resolve at most one imported member by email
                const emails = await ctx.db
                    .query("emails")
                    .withIndex("by_email", (query) => query.eq("email", address))
                    .take(2);
                if (emails.length > 1) {
                    throw new Error(`Multiple members have the email ${address}.`);
                }

                // claim an imported member or create a private member
                const memberEmail = emails[0];
                const authUser = { ...user, email: address };
                const memberId =
                    memberEmail === undefined
                        ? await createMember(ctx, authUser, now)
                        : await claimMember(ctx, memberEmail.memberId, authUser, now);

                // link the Better Auth identity to the member
                await ctx.db.insert("accounts", {
                    authId: user._id,
                    createdAt: now,
                    memberId,
                    status: "active",
                    isTeam: false,
                    updatedAt: now,
                });

                // subscribe new accounts to the programme and event announcements
                await ctx.scheduler.runAfter(0, internal.mail.preferences.enroll, {
                    email: address,
                    memberId,
                });
            },
            onUpdate: async (ctx, user) => {
                // Fill an absent avatar without overwriting the member’s chosen portrait.
                const account = await ctx.db
                    .query("accounts")
                    .withIndex("by_auth", (query) => query.eq("authId", user._id))
                    .unique();
                if (!account) throw new Error("Member account is missing.");
                const member = await ctx.db.get(account.memberId);
                if (member && !member.avatarUrl && user.image)
                    await ctx.db.patch(member._id, {
                        avatarUrl: user.image,
                        updatedAt: Date.now(),
                    });
            },
            onDelete: async (ctx, user) => {
                const account = await ctx.db
                    .query("accounts")
                    .withIndex("by_auth", (query) => query.eq("authId", user._id))
                    .unique();

                // require and remove the local account link
                if (account === null) {
                    throw new Error(`Account does not exist for auth user ${user._id}.`);
                }
                await ctx.db.delete(account._id);
            },
        },
    },
});
