import { requireCheckoutClosed, requirePrincipalPlace } from "./checkout";
import { v } from "convex/values";
import { query, mutation, type QueryCtx } from "./_generated/server";
import { requireTeam } from "./access";
import { paidTerm, recordPayment } from "./payments";
import { requireCompany } from "./organisations";
import { tiers } from "../shared/plans";
import { tier } from "./purchase";
import { normalizeEmail } from "./email";

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
            .withIndex("by_company", (q) => q.eq("organisationId", args.organisationId))
            .collect();
        const pending = rows.find((row) => row.status === "requested");
        if (pending && pending.tier === args.tier) return pending._id;
        // reject overlapping requests or paid terms
        for (const row of rows) {
            const term = await paidTerm(ctx, row._id);
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
        if (!row) throw new Error("Sponsorship not found.");
        await requireCheckoutClosed(ctx, row._id);
        if (row.status === "declined" || row.status === "ended")
            throw new Error("Request a new sponsorship before recording payment.");
        if (row.tier === "principal") await requirePrincipalPlace(ctx, row._id);
        const companySponsors = await ctx.db
            .query("sponsorships")
            .withIndex("by_company", (q) => q.eq("organisationId", row.organisationId))
            .collect();

        // keep one active sponsorship per company
        for (const sponsor of companySponsors) {
            const term = await paidTerm(ctx, sponsor._id);
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
            memberId: (await requireCompany(ctx, row.organisationId)).organisation.ownerMemberId,
            amount: plan.price,
            name: `${plan.name} sponsorship · one year`,
            recordedBy: reviewer.memberId,
            paidAt: Date.now(),
        });

        // activate recognition and clear the renewal request
        await ctx.db.patch(row._id, {
            status: "active",
            note: undefined,
            renewalRequested: false,
            updatedAt: Date.now(),
        });
    },
});

/** Decline a request or end a sponsorship explicitly. */
export const end = mutation({
    args: { id: v.id("sponsorships"), note: v.string() },
    handler: async (ctx, args) => {
        // require a team decision and prevent changes during checkout
        await requireTeam(ctx);
        const row = await ctx.db.get(args.id);
        if (!row) throw new Error("Sponsorship not found.");
        await requireCheckoutClosed(ctx, row._id);
        if (!args.note.trim()) throw new Error("Explain the decision.");
        await ctx.db.patch(row._id, {
            status: row.status === "requested" ? "declined" : "ended",
            note: args.note.trim(),
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
        if (!row) throw new Error("Sponsorship not found.");
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
            await ctx.db.patch(row._id, { renewalRequested: true, updatedAt: Date.now() });
        }
    },
});

/** Resolve sponsor identities for both the website and newsletter. */
export async function activeSponsors(ctx: Pick<QueryCtx, "db">) {
    // select active sponsorships with current paid coverage
    const now = Date.now();
    const rows = await ctx.db
        .query("sponsorships")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect();
    const terms = await Promise.all(
        rows.map(async (row) => ({ row, term: await paidTerm(ctx, row._id) })),
    );
    const active = terms.filter(({ term }) => term && term.endsAt > now).map(({ row }) => row);

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
                logoUrl: organisation.logoUrl,
            };
        }),
    );
}
