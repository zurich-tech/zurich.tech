import { ConvexError, v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { requireAccount } from "../auth/access";

/** Store a small, browser-normalised profile image for the signed-in account. */
export const upload = action({
    args: { bytes: v.bytes() },
    handler: async (ctx, args): Promise<void> => {
        await ctx.runQuery(api.auth.queries.current, {});
        const bytes = new Uint8Array(args.bytes);
        const text = (start: number, end: number) =>
            String.fromCharCode(...bytes.slice(start, end));
        if (
            bytes.length > 512000 ||
            bytes.length < 16 ||
            text(0, 4) !== "RIFF" ||
            text(8, 12) !== "WEBP"
        )
            throw new ConvexError("Choose a valid image under 500 KB after resizing.");
        const id = await ctx.storage.store(new Blob([args.bytes], { type: "image/webp" }));

        // remove an unclaimed upload if the account becomes unavailable
        try {
            await ctx.runMutation(internal.members.avatars.attach, { id });
        } catch (error) {
            await ctx.storage.delete(id);
            throw error;
        }
    },
});

/** Attach only images created by the authenticated upload action. */
export const attach = internalMutation({
    args: { id: v.id("_storage") },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        const member = await ctx.db.get(account.memberId);
        if (!member) throw new Error("Member not found.");
        const avatarUrl = await ctx.storage.getUrl(args.id);
        if (!avatarUrl) throw new ConvexError("Image not found.");
        await ctx.db.patch(member._id, {
            avatarId: args.id,
            avatarUrl,
            avatarDarkUrl: undefined,
            updatedAt: Date.now(),
        });
        if (member.avatarId) await ctx.storage.delete(member.avatarId);
    },
});
