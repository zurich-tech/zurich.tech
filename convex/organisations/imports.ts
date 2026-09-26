import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { organisationKind } from "./kinds";

/** Import researched organisations with one public location each, keeping every existing record. */
export const apply = internalMutation({
    args: {
        apply: v.boolean(),
        organisations: v.array(
            v.object({
                slug: v.string(),
                name: v.string(),
                kind: organisationKind,
                headline: v.string(),
                description: v.string(),
                website: v.string(),
                logoUrl: v.optional(v.string()),
                mapLogoUrl: v.optional(v.string()),
                address: v.object({
                    line1: v.string(),
                    line2: v.optional(v.string()),
                    postalCode: v.string(),
                    locality: v.string(),
                    countryCode: v.string(),
                    latitude: v.number(),
                    longitude: v.number(),
                }),
            }),
        ),
    },
    handler: async (ctx, args) => {
        const result = { created: 0, existing: 0 };
        for (const organisation of args.organisations) {
            const { address, ...fields } = organisation;

            // reject malformed records before writing anything in this batch
            if (
                !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug) ||
                !fields.name.trim() ||
                fields.headline.length > 160 ||
                !/^https:\/\//.test(fields.website) ||
                !/^[A-Z]{2}$/.test(address.countryCode) ||
                Math.abs(address.latitude - 47.4) > 1 ||
                Math.abs(address.longitude - 8.6) > 1
            )
                throw new Error(`Invalid organisation: ${fields.slug}.`);

            // keep existing records, including their edits and ownership
            const existing = await ctx.db
                .query("organisations")
                .withIndex("by_slug", (q) => q.eq("slug", fields.slug))
                .unique();
            if (existing) {
                result.existing++;
            }
            // count new records on a dry run
            else if (!args.apply) {
                result.created++;
            }
            // create new records with their address and public location
            else {
                result.created++;
                const now = Date.now();
                const organisationId = await ctx.db.insert("organisations", {
                    ...fields,
                    location: address.locality,
                    updatedAt: now,
                });
                const addressId = await ctx.db.insert("addresses", {
                    ...address,
                    createdAt: now,
                    updatedAt: now,
                });
                await ctx.db.insert("locations", {
                    ownerId: organisationId,
                    visibility: "public",
                    addressId,
                    name: fields.name,
                });
            }
        }

        return result;
    },
});
