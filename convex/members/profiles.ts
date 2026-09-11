import { readProfiles, writeProfiles } from "./links";
import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireAccount } from "../auth/access";
import { searchText } from "./search";
import { socialLinks } from "./urls";

/** Read the current account's editable public links. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        const viewer = await requireAccount(ctx);
        const member = await ctx.db.get(viewer.memberId);
        if (!member) throw new Error("Member not found.");

        return { headline: member.headline, ...(await readProfiles(ctx, member._id, "all")) };
    },
});

/** Save only the current member's links; paid status is managed separately. */
export const save = mutation({
    args: {
        headline: v.optional(v.string()),
        profileUrl: v.optional(v.string()),
        socials: v.optional(socialLinks),
    },
    handler: async (ctx, args) => {
        const viewer = await requireAccount(ctx);
        const member = await ctx.db.get(viewer.memberId);
        if (!member) throw new Error("Member not found.");
        const headline = args.headline?.trim() || undefined;
        if ((headline?.length ?? 0) > 160)
            throw new Error("Keep the headline within 160 characters.");

        // rebuild searchable profile copy from the current identity and interests
        const taggings = await ctx.db
            .query("taggings")
            .withIndex("by_member", (q) => q.eq("memberId", viewer.memberId))
            .collect();
        const tags = await Promise.all(taggings.map((tagging) => ctx.db.get(tagging.tagId)));
        await ctx.db.patch(viewer.memberId, {
            headline,
            searchText: searchText(
                member.name,
                headline,
                member.bio,
                ...tags.map((tag) => tag?.name),
            ),
            updatedAt: Date.now(),
        });
        await writeProfiles(ctx, viewer.memberId, args);
    },
});
