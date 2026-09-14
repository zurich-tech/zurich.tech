import { readProfiles } from "../members/links";
import { requireCheckoutClosed } from "../billing/checkouts";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, mutation, type QueryCtx } from "../_generated/server";
import { requireAdmin } from "../auth/access";
import { readTerms, selectTerm } from "./terms";
import { paidTerm } from "../billing/payments";
import { requireCompany } from "../organisations/mutations";
import { tier } from "../billing/purchases";
import { normalizeEmail } from "../members/emails";

/** Read active public sponsor identities without billing or account information. */
export const list = query({
    args: {},
    handler: async (ctx) => await activeSponsors(ctx),
});

/** Request an annual sponsorship for an owned company. */
export const request = mutation({
    args: {
        organisationId: v.id("organisations"),
        tier,
        billingEmail: v.string(),
    },
    handler: async (ctx, args) => {
        // require company ownership and read its existing requests
        await requireCompany(ctx, args.organisationId);
        const existing = await ctx.db
            .query("sponsorships")
            .withIndex("by_organisation", (q) => q.eq("organisationId", args.organisationId))
            .unique();
        if (existing) {
            // keep one relationship and retain all prior agreements under it
            if (existing.status === "active")
                throw new Error("Manage or renew this sponsorship in the workspace.");
            await ctx.db.patch(existing._id, {
                tier: args.tier,
                billingEmail: normalizeEmail(args.billingEmail),
                status: "requested",
                updatedAt: Date.now(),
            });
            return existing._id;
        }

        return await ctx.db.insert("sponsorships", {
            ...args,
            billingEmail: normalizeEmail(args.billingEmail),
            isPublic: true,
            status: "requested",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },
});

/** Decline a request or end a sponsorship explicitly. */
export const end = mutation({
    args: { id: v.id("sponsorships") },
    handler: async (ctx, args) => {
        // require a team decision and prevent changes during checkout
        await requireAdmin(ctx);
        const row = await ctx.db.get(args.id);
        if (!row || !("organisationId" in row))
            throw new Error("Organisation sponsorship not found.");
        await requireCheckoutClosed(ctx, row._id);
        if (row.status !== "requested")
            throw new Error("End individual agreements in the sponsorship history.");
        await ctx.db.patch(row._id, {
            status: "declined",
            updatedAt: Date.now(),
        });
    },
});

/** Request renewal or withdraw an unpaid sponsorship request. */
export const updateRequest = mutation({
    args: { id: v.id("sponsorships"), action: v.union(v.literal("renew"), v.literal("withdraw")) },
    handler: async (ctx, args) => {
        // require ownership before renewal or withdrawal
        const row = await ctx.db.get(args.id);
        if (!row || !("organisationId" in row))
            throw new Error("Organisation sponsorship not found.");
        await requireCompany(ctx, row.organisationId);

        // withdraw only an unpaid request with no open checkout
        if (args.action === "withdraw") {
            await requireCheckoutClosed(ctx, row._id);
            if (row.status !== "requested")
                throw new Error("Only unpaid requests can be withdrawn.");
            await ctx.db.patch(row._id, {
                status: "ended",
                note: "Request withdrawn.",
                updatedAt: Date.now(),
            });
        } else {
            if (row.status !== "active")
                throw new Error("Request a sponsorship before renewing it.");
            await ctx.db.patch(row._id, { isRenewalRequested: true, updatedAt: Date.now() });
        }
    },
});

/** Resolve sponsor identities for both the website and newsletter. */
export async function activeSponsors(ctx: Pick<QueryCtx, "db">) {
    // select public recognition from agreed publication dates
    const now = Date.now();
    const rows = await ctx.db
        .query("sponsorships")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect();
    const terms = await Promise.all(
        rows.map(async (row) => ({
            row,
            term:
                "organisationId" in row
                    ? selectTerm(await readTerms(ctx, row._id), now, true)
                    : null,
        })),
    );
    const active = terms
        .filter(({ term }) => term && term.endsAt > now)
        .map(({ row, term }) => ({ ...row, tier: term!.tier }))
        .filter(
            (row): row is Extract<Doc<"sponsorships">, { organisationId: unknown }> =>
                "organisationId" in row && row.isPublic,
        );

    return await Promise.all(
        active.map(async (row) => {
            const organisation = await ctx.db.get(row.organisationId);
            if (!organisation) throw new Error("Sponsor company is missing.");

            return {
                id: row._id,
                organisationId: row.organisationId,
                tier: row.tier,
                name: organisation.name,
                website: organisation.website,
                ...(await readProfiles(ctx, organisation._id)),
                logoUrl: organisation.logoUrl,
                logoDarkUrl: organisation.logoDarkUrl,
            };
        }),
    );
}

/** Resolve benefits from agreed dates; personal support retains its payment coverage. */
export async function sponsorshipTerm(ctx: Pick<QueryCtx, "db">, sponsor: Doc<"sponsorships">) {
    if ("organisationId" in sponsor)
        return selectTerm(await readTerms(ctx, sponsor._id), Date.now());
    const term = await paidTerm(ctx, sponsor._id);

    return term ? { ...term, tier: sponsor.tier } : null;
}
