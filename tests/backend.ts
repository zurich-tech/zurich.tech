import { mock } from "bun:test";
import type { GenericQueryCtx, GenericDataModel } from "convex/server";
import type { MutationCtx, QueryCtx } from "../convex/_generated/server";
import type { Doc, Id } from "../convex/_generated/dataModel";
export { convexTest } from "convex-test";
export { default as schema } from "../convex/schema";
export { insertSubscription, updateSubscription } from "../convex/mail/contacts";

// replace only the identity provider; account and permission checks run unchanged
mock.module("../convex/auth/component", () => ({
    authComponent: {
        getAuthUser: async (ctx: GenericQueryCtx<GenericDataModel>) => {
            const identity = await ctx.auth.getUserIdentity();
            if (!identity) throw new Error("Sign in required.");
            return { _id: identity.subject, email: "test@example.invalid", emailVerified: true };
        },
    },
}));

/** Discover functions once; every convexTest call still owns an isolated database. */
export const modules = Object.fromEntries(
    [...new Bun.Glob("**/*.ts").scanSync({ cwd: "convex" })].map((path) => [
        `../convex/${path}`,
        () => import(`../convex/${path}`),
    ]),
);

/** Seed a profile with explicit scenario fields and no account or permission grants. */
export function member(
    ctx: MutationCtx,
    fields: Pick<Doc<"members">, "name" | "searchText" | "visibility">,
) {
    return ctx.db.insert("members", { ...fields, status: "active", createdAt: 1, updatedAt: 1 });
}

/** Store an email fixture with the same content separation as the delivery queue. */
export async function insertMessage(
    ctx: MutationCtx,
    fields: Omit<Doc<"messages">, "_id" | "_creationTime"> & { text: string; html?: string },
) {
    const { text, html, ...delivery } = fields;
    const messageId = await ctx.db.insert("messages", delivery);
    await ctx.db.insert("messageContents", { messageId, text, html });

    return messageId;
}

/** Read immutable content when an assertion concerns rendered mail. */
export async function messageContent(ctx: QueryCtx, id: Id<"messages">) {
    const content = await ctx.db
        .query("messageContents")
        .withIndex("by_message", (query) => query.eq("messageId", id))
        .unique();
    if (!content) throw new Error("message content is missing");

    return { text: content.text, html: content.html };
}
