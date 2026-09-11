import { demographics } from "./demographics";
import { readProfiles, writeProfiles } from "./links";
import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requireAccount } from "../auth/access";
import { searchText } from "./search";
import { normalizeImageUrl, socialLinks } from "./urls";

/** Read the signed-in member's editable profile. */
export const current = query({
    args: {},
    handler: async (ctx) => {
        const viewer = await requireAccount(ctx);
        const member = await ctx.db.get(viewer.memberId);
        if (!member) throw new Error("Member not found.");

        return {
            demographics: viewer.demographics ?? {},
            visibility: member.visibility,
            handle: (
                await ctx.db
                    .query("handles")
                    .withIndex("by_member", (q) => q.eq("memberId", member._id))
                    .collect()
            ).find((handle) => handle.status === "active")?.name,
            name: member.name,
            headline: member.headline,
            bio: member.bio,
            avatarUrl: member.avatarUrl,
            avatarDarkUrl: member.avatarDarkUrl,
            ...(await readProfiles(ctx, member._id, "all")),
        };
    },
});

/** Save the signed-in member's public profile and links. */
export const save = mutation({
    args: {
        demographics: v.optional(demographics),
        name: v.string(),
        handle: v.optional(v.string()),
        isPublic: v.boolean(),
        headline: v.optional(v.string()),
        bio: v.optional(v.string()),
        profileUrl: v.optional(v.string()),
        socials: v.optional(socialLinks),
    },
    handler: async (ctx, args) => {
        const viewer = await requireAccount(ctx);
        const member = await ctx.db.get(viewer.memberId);
        if (!member) throw new Error("Member not found.");
        const name = args.name.trim();
        const bio = args.bio?.trim() || undefined;
        if (!name || name.length > 120) throw new Error("Enter a name, up to 120 characters.");
        if ((bio?.length ?? 0) > 1000) throw new Error("Keep your bio within 1,000 characters.");
        const headline = args.headline?.trim() || undefined;
        if ((headline?.length ?? 0) > 160)
            throw new Error("Keep the headline within 160 characters.");

        // reserve the chosen public address without allowing another member's handle
        const handle = args.handle?.trim() ? normalizeHandle(args.handle) : undefined;
        if (args.isPublic && !handle) throw new Error("Choose a slug for your public profile.");
        const handles = await ctx.db
            .query("handles")
            .withIndex("by_member", (q) => q.eq("memberId", member._id))
            .collect();
        if (handle) {
            const existing = await ctx.db
                .query("handles")
                .withIndex("by_name", (q) => q.eq("name", handle))
                .unique();
            if (existing && existing.memberId !== member._id && existing.status !== "released")
                throw new Error("This slug is already taken.");
            if (existing)
                await ctx.db.patch(existing._id, {
                    memberId: member._id,
                    status: "active",
                    updatedAt: Date.now(),
                });
            else
                await ctx.db.insert("handles", {
                    name: handle,
                    memberId: member._id,
                    status: "active",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                });
        }
        for (const previous of handles)
            if (previous.name !== handle && previous.status === "active")
                await ctx.db.patch(previous._id, { status: "released", updatedAt: Date.now() });

        // rebuild searchable profile copy from the current identity and interests
        const taggings = await ctx.db
            .query("taggings")
            .withIndex("by_member", (q) => q.eq("memberId", viewer.memberId))
            .collect();
        const tags = await Promise.all(taggings.map((tagging) => ctx.db.get(tagging.tagId)));
        await ctx.db.patch(viewer.memberId, {
            name,
            visibility: args.isPublic ? "public" : "private",
            headline,
            bio,
            searchText: searchText(name, headline, bio, ...tags.map((tag) => tag?.name)),
            updatedAt: Date.now(),
        });
        await writeProfiles(ctx, viewer.memberId, args);
        if (args.demographics !== undefined)
            await ctx.db.patch(viewer._id, {
                demographics: args.demographics,
                updatedAt: Date.now(),
            });
    },
});

/** Replace the signed-in member's portrait with their selected provider photo. */
export const refreshPhoto = mutation({
    args: { image: v.string() },
    handler: async (ctx, args) => {
        const account = await requireAccount(ctx);
        const member = await ctx.db.get(account.memberId);
        if (!member) throw new Error("Member not found.");
        const avatarUrl = normalizeImageUrl(args.image);
        if (!avatarUrl) throw new Error("The provider has no profile photo.");

        await ctx.db.patch(account.memberId, {
            avatarUrl,
            avatarId: undefined,
            avatarDarkUrl: undefined,
            updatedAt: Date.now(),
        });
        if (member.avatarId) await ctx.storage.delete(member.avatarId);
    },
});

/** Check whether a profile slug can be claimed by the signed-in member. */
export const available = query({
    args: { handle: v.string() },
    handler: async (ctx, args) => {
        const viewer = await requireAccount(ctx);
        const handle = normalizeHandle(args.handle);
        const existing = await ctx.db
            .query("handles")
            .withIndex("by_name", (q) => q.eq("name", handle))
            .unique();
        return {
            isAvailable:
                !existing ||
                existing.memberId === viewer.memberId ||
                existing.status === "released",
        };
    },
});

/** Normalize a member slug and enforce its format for lookup and saving. */
function normalizeHandle(value: string) {
    const handle = value.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{2,39}$/.test(handle))
        throw new Error("Use 3–40 letters, numbers or hyphens, starting with a letter.");

    return handle;
}
