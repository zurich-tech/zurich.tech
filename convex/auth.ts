import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import type { GenericMutationCtx } from "convex/server";

import { components, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { normalizeEmail } from "./email";
import { searchText } from "./search";

/** Internal functions invoked by authentication triggers. */
const authFunctions: AuthFunctions = internal.auth;

/** Authenticated identity fields used to create a member. */
type AuthUser = {
    /** The primary authenticated email. */
    email: string;
    /** Whether the provider verified the email. */
    emailVerified: boolean;
    /** The provider display name. */
    name: string;
};

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
                    throw new Error("A verified GitHub email is required.");
                }

                // reject duplicate auth identities
                const account = await ctx.db
                    .query("accounts")
                    .withIndex("by_authId", (query) => query.eq("authId", user._id))
                    .unique();
                if (account !== null) {
                    throw new Error(`Account already exists for auth user ${user._id}.`);
                }

                // resolve at most one imported member by email
                const emails = await ctx.db
                    .query("memberEmails")
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
                    updatedAt: now,
                });
            },
            onDelete: async (ctx, user) => {
                const account = await ctx.db
                    .query("accounts")
                    .withIndex("by_authId", (query) => query.eq("authId", user._id))
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

/** Create the Better Auth server for one Convex request. */
export function createAuth(ctx: GenericCtx<DataModel>) {
    const siteUrl = requiredEnvironment("SITE_URL");

    return betterAuth({
        baseURL: requiredEnvironment("CONVEX_SITE_URL"),
        database: authComponent.adapter(ctx),
        plugins: [crossDomain({ siteUrl }), convex({ authConfig })],
        socialProviders: {
            github: {
                clientId: requiredEnvironment("GITHUB_CLIENT_ID"),
                clientSecret: requiredEnvironment("GITHUB_CLIENT_SECRET"),
            },
        },
        trustedOrigins: [siteUrl],
    });
}

/** Better Auth trigger functions. */
export const { onCreate, onDelete, onUpdate } = authComponent.triggersApi();

/** Authenticated user query. */
export const { getAuthUser } = authComponent.clientApi();

/** Create a private member for a new authenticated email. */
async function createMember(ctx: GenericMutationCtx<DataModel>, user: AuthUser, now: number) {
    const memberId = await ctx.db.insert("members", {
        createdAt: now,
        name: user.name,
        searchText: searchText(user.name, user.email),
        source: "github",
        status: "active",
        updatedAt: now,
        visibility: "private",
    });

    // retain the verified sign-in address
    await ctx.db.insert("memberEmails", {
        createdAt: now,
        email: user.email,
        isPrimary: true,
        memberId,
        source: "github",
        updatedAt: now,
        verifiedAt: user.emailVerified ? now : undefined,
    });

    return memberId;
}

/** Claim an existing member with the authenticated email. */
async function claimMember(
    ctx: GenericMutationCtx<DataModel>,
    memberId: Id<"members">,
    user: AuthUser,
    now: number,
) {
    const member = await ctx.db.get(memberId);
    if (member === null) {
        throw new Error(`Member ${memberId} does not exist.`);
    }

    // reject identities disabled by staff
    if (member.status === "blocked" || member.status === "deleted") {
        throw new Error("This member cannot sign in.");
    }

    // activate imported members and preserve established profiles
    const isImported = member.status === "imported";
    const name = isImported ? user.name : member.name;
    await ctx.db.patch(memberId, {
        name,
        searchText: searchText(member.searchText, name, user.email),
        status: isImported ? "active" : member.status,
        updatedAt: now,
    });

    // mark the matching address as verified by GitHub
    const email = await ctx.db
        .query("memberEmails")
        .withIndex("by_email", (query) => query.eq("email", user.email))
        .unique();
    if (email === null) {
        throw new Error(`Member ${memberId} no longer owns ${user.email}.`);
    }
    if (user.emailVerified) {
        await ctx.db.patch(email._id, { updatedAt: now, verifiedAt: now });
    }

    return memberId;
}

/** Read a required Convex environment variable. */
export function requiredEnvironment(name: string) {
    const value = process.env[name];
    if (value === undefined || value.length === 0) {
        throw new Error(`${name} is not configured.`);
    }

    return value;
}
