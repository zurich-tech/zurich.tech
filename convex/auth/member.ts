import type { GenericMutationCtx } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import { searchText } from "../search";

/** Authenticated identity fields used to create a member. */
type AuthUser = {
    /** The primary authenticated email. */
    email: string;
    /** Whether the provider verified the email. */
    emailVerified: boolean;
    /** The provider display name. */
    name: string;
    /** The current provider avatar URL. */
    image?: string | null;
};

/** Create a private member for a new authenticated email. */
export async function createMember(
    ctx: GenericMutationCtx<DataModel>,
    user: AuthUser,
    now: number,
) {
    const memberId = await ctx.db.insert("members", {
        createdAt: now,
        name: user.name,
        avatarUrl: user.image ?? undefined,
        searchText: searchText(user.name, user.email),
        source: "social",
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
        source: "social",
        updatedAt: now,
        verifiedAt: user.emailVerified ? now : undefined,
    });

    return memberId;
}

/** Claim an existing member with the authenticated email. */
export async function claimMember(
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
        avatarUrl: user.image ?? undefined,
        searchText: searchText(member.searchText, name, user.email),
        status: isImported ? "active" : member.status,
        updatedAt: now,
    });

    // mark the matching address as verified by the identity provider
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
