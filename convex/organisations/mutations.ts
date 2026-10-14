import { organisationKind } from "./kinds";
import { writeProfiles } from "../members/links";
import { ConvexError, v } from "convex/values";
import { mutation, internalMutation, type QueryCtx, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { normalizeEmail } from "../members/emails";
import { requireAccount, requireTeam } from "../auth/access";
import { normalizeUrl, normalizeImageUrl, socialLinks } from "../members/urls";
import { validateSpecificTopics } from "../topics/queries";
import { normalizeHeadline } from "./headlines";

/** Upsert a curated organisation. */
export const upsert = mutation({
    args: {
        id: v.optional(v.id("organisations")),
        slug: v.string(),
        name: v.string(),
        headline: v.optional(v.string()),
        description: v.string(),
        kind: organisationKind,
        topics: v.optional(v.array(v.string())),
        website: v.string(),
        location: v.string(),
    },
    handler: async (ctx, args) => {
        // restrict directory editing to the team
        await requireTeam(ctx);
        const { id, topics, ...fields } = args;
        const previous = id ? await ctx.db.get(id) : null;
        if (id && !previous) throw new ConvexError("Organisation not found.");
        if (topics !== undefined) await validateSpecificTopics(ctx, topics, previous?.topics);
        const values = { ...fields, ...(topics === undefined ? {} : { topics }) };
        if (
            !values.name.trim() ||
            values.name.length > 160 ||
            (values.headline?.length ?? 0) > 160 ||
            values.description.length > 5000 ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)
        )
            throw new ConvexError("Enter a name, valid slug, and concise description.");
        values.website = normalizeUrl(values.website);
        values.headline = normalizeHeadline(values.headline ?? "") || undefined;

        // reject another organisation using the same URL
        const collision = await ctx.db
            .query("organisations")
            .withIndex("by_slug", (range) => range.eq("slug", values.slug))
            .unique();
        if (collision && collision._id !== id)
            throw new ConvexError("An organisation already uses this URL.");

        // update the existing profile or create its first record
        if (id) {
            await ctx.db.patch(id, { ...values, updatedAt: Date.now() });

            return id;
        }

        return await ctx.db.insert("organisations", { ...values, updatedAt: Date.now() });
    },
});

/** Require management access to a company profile. */
export async function requireCompany(ctx: QueryCtx | MutationCtx, id: Id<"organisations">) {
    const viewer = await requireAccount(ctx);
    const organisation = await ctx.db.get(id);
    if (!organisation || (!viewer.isAdmin && organisation.ownerId !== viewer.memberId))
        throw new ConvexError("You cannot manage this company.");

    return { viewer, organisation };
}

/** Allow directory edits without granting company billing or ownership authority. */
export async function requireOrganisation(ctx: QueryCtx | MutationCtx, id: Id<"organisations">) {
    const viewer = await requireAccount(ctx);
    const organisation = await ctx.db.get(id);
    if (
        !organisation ||
        (!viewer.isAdmin && !viewer.isTeam && organisation.ownerId !== viewer.memberId)
    )
        throw new ConvexError("You cannot manage this organisation.");

    return { viewer, organisation };
}

/** Create or edit a company used on approved jobs and sponsorships. */
export const upsertCompany = mutation({
    args: {
        id: v.optional(v.id("organisations")),
        ownerEmail: v.optional(v.string()),
        name: v.string(),
        kind: organisationKind,
        topics: v.optional(v.array(v.string())),
        headline: v.optional(v.string()),
        slug: v.string(),
        website: v.string(),
        logoUrl: v.optional(v.string()),
        logoDarkUrl: v.optional(v.string()),
        mapLogoUrl: v.optional(v.string()),
        mapLogoDarkUrl: v.optional(v.string()),
        profileUrl: v.optional(v.string()),
        socials: v.optional(socialLinks),
        location: v.string(),
        description: v.string(),
    },
    handler: async (ctx, args) => {
        // require directory authority or ownership of an existing company
        const viewer = await requireAccount(ctx);
        const previous = args.id ? (await requireOrganisation(ctx, args.id)).organisation : null;
        if (args.topics !== undefined)
            await validateSpecificTopics(ctx, args.topics, previous?.topics);
        if (
            !args.name.trim() ||
            args.name.length > 160 ||
            (args.headline?.length ?? 0) > 160 ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug) ||
            args.description.length > 5000 ||
            !args.location.trim()
        )
            throw new ConvexError(
                "Enter a company name, URL slug, location and concise description.",
            );

        // reject another organisation using the same URL
        const collision = await ctx.db
            .query("organisations")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .unique();
        if (collision && collision._id !== args.id)
            throw new ConvexError(
                "This company URL is already taken. Ask the team to grant access to the existing company.",
            );

        // let administrators assign a company to a verified signed in member
        let ownerId: Id<"members"> | undefined;
        if (args.ownerEmail) {
            if (!viewer.isAdmin)
                throw new ConvexError("Admin access is required to assign a company.");
            const address = await ctx.db
                .query("emails")
                .withIndex("by_email", (q) => q.eq("email", normalizeEmail(args.ownerEmail!)))
                .unique();
            const ownerAccount = address
                ? await ctx.db
                      .query("accounts")
                      .withIndex("by_member", (q) => q.eq("memberId", address.memberId))
                      .unique()
                : null;
            if (!address?.verifiedAt || ownerAccount?.status !== "active")
                throw new ConvexError(
                    "The company owner must sign in first with a verified email.",
                );
            ownerId = address.memberId;
        }

        // keep company identity stable while allowing its owner to maintain public details
        const { id, ownerEmail, profileUrl, socials, topics, ...fields } = args;
        const values = {
            ...fields,
            ...(topics === undefined ? {} : { topics }),
            name: args.name.trim(),
            headline: normalizeHeadline(args.headline ?? "") || undefined,
            website: normalizeUrl(args.website),
            logoUrl: args.logoUrl ? normalizeImageUrl(args.logoUrl) : undefined,
            logoDarkUrl: args.logoDarkUrl ? normalizeImageUrl(args.logoDarkUrl) : undefined,
            mapLogoUrl: args.mapLogoUrl ? normalizeImageUrl(args.mapLogoUrl) : undefined,
            mapLogoDarkUrl: args.mapLogoDarkUrl
                ? normalizeImageUrl(args.mapLogoDarkUrl)
                : undefined,
            updatedAt: Date.now(),
        };

        // update the existing profile or create its first record
        if (id) {
            await ctx.db.patch(id, { ...values, ...(ownerId ? { ownerId } : {}) });

            await writeProfiles(ctx, id, { profileUrl, socials });
            return id;
        }

        const organisationId = await ctx.db.insert("organisations", {
            ...values,
            ownerId: ownerId ?? (viewer.isTeam || viewer.isAdmin ? undefined : viewer.memberId),
        });
        await writeProfiles(ctx, organisationId, { profileUrl, socials });
        return organisationId;
    },
});

/** Designate the community host through the authenticated deployment CLI. */
export const setHost = internalMutation({
    args: { organisationId: v.id("organisations") },
    handler: async (ctx, args) => {
        if (!(await ctx.db.get(args.organisationId)))
            throw new ConvexError("Organisation not found.");

        // Keep a single host while allowing its identity to change without code changes.
        for (const organisation of await ctx.db.query("organisations").collect()) {
            const isHost = organisation._id === args.organisationId;
            if (Boolean(organisation.isHost) !== isHost)
                await ctx.db.patch(organisation._id, { isHost, updatedAt: Date.now() });
        }
    },
});

/** Reclassify an existing organisation through the authenticated deployment CLI. */
export const setKind = internalMutation({
    args: { organisationId: v.id("organisations"), kind: organisationKind },
    handler: async (ctx, { organisationId, kind }) => {
        await ctx.db.patch(organisationId, { kind, updatedAt: Date.now() });
    },
});
