import { readProfiles } from "../members/links";
import { requireCheckoutClosed } from "../billing/checkouts";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, mutation, internalMutation, type QueryCtx } from "../_generated/server";
import { requireTeam } from "../auth/access";
import { paidTerm, recordPayment } from "../billing/payments";
import { requireCompany } from "../organisations/mutations";
import { tiers } from "../../src/sponsorships/plans";
import { tier } from "../billing/purchases";
import { normalizeEmail } from "../members/emails";
import { normalizeImageUrl } from "../members/urls";

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
        const rows = await ctx.db
            .query("sponsorships")
            .withIndex("by_organisation", (q) => q.eq("organisationId", args.organisationId))
            .collect();
        const pending = rows.find((row) => row.status === "requested");
        if (pending && pending.tier === args.tier) return pending._id;
        // reject overlapping requests or current agreements
        for (const row of rows) {
            const term = await sponsorshipTerm(ctx, row);
            if (
                row.status === "requested" ||
                (row.status === "active" && term && term.endsAt > Date.now())
            )
                throw new Error(
                    "This company already has an open sponsorship. Manage or renew it in the workspace.",
                );
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

/** Activate or renew a sponsorship after the team confirms its invoice payment. */
export const activate = mutation({
    args: { id: v.id("sponsorships"), invoiceReference: v.string() },
    handler: async (ctx, args) => {
        // require team access and a closed checkout before recording payment
        const reviewer = await requireTeam(ctx);
        const row = await ctx.db.get(args.id);
        if (!row || row.tier === "patron") throw new Error("Organisation sponsorship not found.");
        if (row.inKind)
            throw new Error("Update the in-kind agreement instead of recording payment.");
        await requireCheckoutClosed(ctx, row._id);
        if (row.status === "declined" || row.status === "ended")
            throw new Error("Request a new sponsorship before recording payment.");
        const companySponsors = await ctx.db
            .query("sponsorships")
            .withIndex("by_organisation", (q) => q.eq("organisationId", row.organisationId))
            .collect();

        // keep one active sponsorship per company
        for (const sponsor of companySponsors) {
            const term = await sponsorshipTerm(ctx, sponsor);
            if (
                sponsor._id !== row._id &&
                sponsor.status === "active" &&
                term &&
                term.endsAt > Date.now()
            )
                throw new Error("This company already has an active sponsorship.");
        }
        // record the annual payment against the company owner when assigned
        const plan = tiers.find((tier) => tier.id === row.tier)!;
        await recordPayment(ctx, {
            reference: args.invoiceReference,
            subjectId: row._id,
            memberId: (await requireCompany(ctx, row.organisationId)).organisation.ownerId,
            amount: plan.price,
            name: `${plan.name} sponsorship · one year`,
            recordedBy: reviewer.memberId,
            paidAt: Date.now(),
        });

        // activate recognition and clear the renewal request
        await ctx.db.patch(row._id, {
            status: "active",
            note: undefined,
            isRenewalRequested: false,
            updatedAt: Date.now(),
        });
    },
});

/** Decline a request or end a sponsorship explicitly. */
export const end = mutation({
    args: { id: v.id("sponsorships") },
    handler: async (ctx, args) => {
        // require a team decision and prevent changes during checkout
        await requireTeam(ctx);
        const row = await ctx.db.get(args.id);
        if (!row || row.tier === "patron") throw new Error("Organisation sponsorship not found.");
        await requireCheckoutClosed(ctx, row._id);
        if (row.status !== "active" && row.status !== "requested")
            throw new Error("This sponsorship is already closed.");
        await ctx.db.patch(row._id, {
            status: row.status === "requested" ? "declined" : "ended",
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
        if (!row || row.tier === "patron") throw new Error("Organisation sponsorship not found.");
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
            if (row.inKind) throw new Error("Contact the team to renew the in-kind agreement.");
            if (row.status !== "active")
                throw new Error("Request a sponsorship before renewing it.");
            await ctx.db.patch(row._id, { isRenewalRequested: true, updatedAt: Date.now() });
        }
    },
});

/** Resolve sponsor identities for both the website and newsletter. */
export async function activeSponsors(ctx: Pick<QueryCtx, "db">) {
    // select active sponsorships with current paid or in-kind coverage
    const now = Date.now();
    const rows = await ctx.db
        .query("sponsorships")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect();
    const terms = await Promise.all(
        rows.map(async (row) => ({ row, term: await sponsorshipTerm(ctx, row) })),
    );
    const active = terms
        .filter(({ term }) => term && term.endsAt > now)
        .map(({ row }) => row)
        .filter(
            (row): row is Extract<Doc<"sponsorships">, { organisationId: unknown }> =>
                row.tier !== "patron" && row.isPublic,
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

/** Grant or renew an agreed in-kind sponsorship through the administrative CLI. */
export const grantInKind = internalMutation({
    args: {
        organisationId: v.id("organisations"),
        tier,
        description: v.string(),
        logoUrl: v.optional(v.string()),
        logoDarkUrl: v.optional(v.string()),
        startsAt: v.number(),
        endsAt: v.number(),
    },
    handler: async (ctx, args) => {
        // require an existing organisation and a current, bounded agreement
        const now = Date.now();
        const description = args.description.trim();
        if (!(await ctx.db.get(args.organisationId))) throw new Error("Organisation not found.");
        if (
            !description ||
            description.length > 240 ||
            !Number.isFinite(args.startsAt) ||
            !Number.isFinite(args.endsAt) ||
            args.startsAt > now ||
            args.endsAt <= now ||
            args.endsAt <= args.startsAt
        )
            throw new Error("Enter a contribution and a term covering today.");

        // renew the existing in-kind agreement without overlapping another sponsorship
        const rows = await ctx.db
            .query("sponsorships")
            .withIndex("by_organisation", (q) => q.eq("organisationId", args.organisationId))
            .collect();
        const existing = rows.find((row) => row.status === "active" && row.inKind);
        for (const row of rows) {
            if (row._id === existing?._id) continue;
            const term = await sponsorshipTerm(ctx, row);
            if (
                row.status === "requested" ||
                (row.status === "active" && term && term.endsAt > now)
            )
                throw new Error("This organisation already has an open sponsorship.");
        }

        // retain the supplied organisation logo for all sponsor placements
        if (args.logoUrl) {
            await ctx.db.patch(args.organisationId, {
                logoUrl: normalizeImageUrl(args.logoUrl),
                logoDarkUrl: args.logoDarkUrl ? normalizeImageUrl(args.logoDarkUrl) : undefined,
                updatedAt: now,
            });
        }

        // require hosted checkout to finish before changing an agreement
        if (existing) await requireCheckoutClosed(ctx, existing._id);
        const values = {
            organisationId: args.organisationId,
            tier: args.tier,
            isPublic: true,
            inKind: { description, startsAt: args.startsAt, endsAt: args.endsAt },
            status: "active" as const,
            isRenewalRequested: false,
            updatedAt: now,
        };
        if (existing) {
            await ctx.db.patch(existing._id, values);

            return existing._id;
        }

        return await ctx.db.insert("sponsorships", { ...values, createdAt: now });
    },
});

/** Resolve tier coverage from an in-kind agreement or annual payments. */
export async function sponsorshipTerm(ctx: Pick<QueryCtx, "db">, sponsor: Doc<"sponsorships">) {
    if (sponsor.inKind) {
        return { startsAt: sponsor.inKind.startsAt, endsAt: sponsor.inKind.endsAt };
    }

    return await paidTerm(ctx, sponsor._id);
}
