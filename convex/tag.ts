import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** A record type that accepts tags. */
export type TagSubject = "event" | "member";

/** Replace the tags attached to one record. */
export async function setTags(
    ctx: MutationCtx,
    subject: TagSubject,
    subjectId: Id<"events"> | Id<"members">,
    slugs: string[],
) {
    const tagIds: Id<"tags">[] = [];
    for (const slug of [...new Set(slugs)]) {
        tagIds.push(await ensureTag(ctx, slug));
    }

    // load the current relation set
    const existing = await ctx.db
        .query("taggings")
        .withIndex("by_subject_and_subjectId", (query) =>
            query.eq("subject", subject).eq("subjectId", subjectId),
        )
        .collect();

    // remove obsolete relations
    const desired = new Set(tagIds);
    for (const tagging of existing) {
        if (!desired.has(tagging.tagId)) {
            await ctx.db.delete(tagging._id);
        }
    }

    // create missing relations
    const existingIds = new Set(existing.map((tagging) => tagging.tagId));
    for (const tagId of tagIds) {
        if (!existingIds.has(tagId)) {
            await ctx.db.insert("taggings", {
                createdAt: Date.now(),
                subject,
                subjectId,
                tagId,
            });
        }
    }
}

/** Create or return one tag. */
async function ensureTag(ctx: MutationCtx, slug: string) {
    const existing = await ctx.db
        .query("tags")
        .withIndex("by_slug", (query) => query.eq("slug", slug))
        .unique();

    if (existing !== null) {
        return existing._id;
    }

    const now = Date.now();

    return await ctx.db.insert("tags", {
        createdAt: now,
        name: slug,
        slug,
        updatedAt: now,
    });
}
