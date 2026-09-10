import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAccount } from "./access";
import { socialLinks, normalizeSocialLinks, normalizeUrl } from "./url";

/** Read the current account's editable public links. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        const viewer = await requireAccount(ctx);
        const member = await ctx.db.get(viewer.memberId);
        if (!member) throw new Error("Member not found.");

        return { profileUrl: member.profileUrl, socials: member.socials };
    },
});

/** Save only the current member's links; paid status is managed separately. */
export const save = mutation({
    args: { profileUrl: v.optional(v.string()), socials: v.optional(socialLinks) },
    handler: async (ctx, args) => {
        const viewer = await requireAccount(ctx);
        await ctx.db.patch(viewer.memberId, {
            profileUrl: args.profileUrl?.trim() ? normalizeUrl(args.profileUrl.trim()) : undefined,
            socials: normalizeSocialLinks(args.socials),
            updatedAt: Date.now(),
        });
    },
});
