import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** Allow explicitly public profiles without requiring a claimed login account. */
export function isPublicMember(member: Doc<"members"> | null): member is Doc<"members"> {
    return (
        member !== null &&
        member.visibility === "public" &&
        (member.status === "active" || member.status === "imported")
    );
}

/** Find the active handle for one member. */
export async function memberHandle(ctx: QueryCtx, memberId: Id<"members">) {
    return await ctx.db
        .query("handles")
        .withIndex("by_member", (query) => query.eq("memberId", memberId))
        .filter((query) => query.eq(query.field("status"), "active"))
        .unique();
}
