import { validateInterests } from "../topics/queries";
import { affiliations, normaliseAffiliations, affiliationText } from "./affiliations";
import {
    demographics,
    validateDemographics,
    validateParticipation,
    validateMotivations,
} from "./demographics";
import { readProfiles, writeProfiles } from "./links";
import { ConvexError, v } from "convex/values";
import { query, mutation, type QueryCtx } from "../_generated/server";
import { authComponent } from "../auth/component";
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
            email: (await authComponent.getAuthUser(ctx)).email,
            demographics: viewer.demographics ?? {},
            interests: viewer.interests ?? [],
            participation: viewer.participation ?? [],
            motivations: viewer.motivations ?? [],
            visibility: member.visibility,
            handle: (
                await ctx.db
                    .query("handles")
                    .withIndex("by_member", (q) => q.eq("memberId", member._id))
                    .collect()
            ).find((handle) => handle.status === "active")?.name,
            name: member.name,
            headline: member.headline,
            affiliations: member.affiliations,
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
        interests: v.optional(v.array(v.string())),
        motivations: v.optional(v.array(v.string())),
        participation: v.optional(v.array(v.string())),
        name: v.string(),
        handle: v.optional(v.string()),
        isPublic: v.boolean(),
        headline: v.optional(v.string()),
        affiliations: v.optional(affiliations),
        bio: v.optional(v.string()),
        profileUrl: v.optional(v.string()),
        socials: v.optional(socialLinks),
    },
    handler: async (ctx, args) => {
        const viewer = await requireAccount(ctx);
        const member = await ctx.db.get(viewer.memberId);
        if (!member) throw new Error("Member not found.");
        if (args.demographics) validateDemographics(args.demographics);
        if (args.interests) await validateInterests(ctx, args.interests, viewer.interests);
        if (args.participation) validateParticipation(args.participation);
        if (args.motivations) validateMotivations(args.motivations);
        const name = args.name.trim();
        const bio = args.bio?.trim() || undefined;
        if (!name || name.length > 120)
            throw new ConvexError("Enter a name, up to 120 characters.");
        if ((bio?.length ?? 0) > 1000)
            throw new ConvexError("Keep your bio within 1,000 characters.");
        const headline = args.headline?.trim() || undefined;
        if ((headline?.length ?? 0) > 160)
            throw new ConvexError("Keep the headline within 160 characters.");

        // reserve the chosen public address without allowing another member's handle
        const handles = await ctx.db
            .query("handles")
            .withIndex("by_member", (q) => q.eq("memberId", member._id))
            .collect();
        let handle = args.handle?.trim()
            ? normalizeHandle(args.handle)
            : handles.find((row) => row.status === "active")?.name;
        if (!handle && args.isPublic) handle = await availableHandle(name, ctx);

        if (handle) {
            const existing = await ctx.db
                .query("handles")
                .withIndex("by_name", (q) => q.eq("name", handle))
                .unique();
            if (existing && existing.memberId !== member._id && existing.status !== "released")
                throw new ConvexError("This profile address is already taken.");
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

        // index only public profile copy, never private survey answers or interests
        await ctx.db.patch(viewer.memberId, {
            name,
            visibility: args.isPublic ? "public" : "private",
            headline,
            affiliations:
                args.affiliations === undefined
                    ? member.affiliations
                    : normaliseAffiliations(args.affiliations),
            bio,
            searchText: searchText(
                name,
                headline,
                affiliationText(args.affiliations ?? member.affiliations),
                bio,
            ),
            updatedAt: Date.now(),
        });
        await writeProfiles(ctx, viewer.memberId, args);
        if (
            args.demographics !== undefined ||
            args.interests !== undefined ||
            args.participation !== undefined ||
            args.motivations !== undefined
        )
            await ctx.db.patch(viewer._id, {
                demographics: args.demographics ?? viewer.demographics,
                interests: args.interests ?? viewer.interests,
                participation: args.participation ?? viewer.participation,
                motivations: args.motivations ?? viewer.motivations,
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
        if (!avatarUrl) throw new ConvexError("The provider has no profile photo.");

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

/** Choose an unclaimed public address without exposing an email or changing an existing URL. */
async function availableHandle(name: string, ctx: QueryCtx): Promise<string> {
    // build a readable address with space for a collision suffix
    const normalized = name
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^[^a-z]+/, "")
        .slice(0, 30)
        .replace(/-+$/, "");
    const base = normalized.length >= 3 ? normalized : "member";

    // let the transaction retry concurrent claims, respecting both active and reserved addresses
    for (let suffix = 1; ; suffix++) {
        const handle = suffix === 1 ? base : `${base}-${suffix}`;
        const existing = await ctx.db
            .query("handles")
            .withIndex("by_name", (q) => q.eq("name", handle))
            .unique();
        if (!existing || existing.status === "released") return handle;
    }
}

/** Normalize a member slug and enforce its format for lookup and saving. */
function normalizeHandle(value: string) {
    const handle = value.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{2,39}$/.test(handle))
        throw new ConvexError("Use 3–40 letters, numbers or hyphens, starting with a letter.");

    return handle;
}
