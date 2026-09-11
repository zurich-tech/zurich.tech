import { jobPrice, jobDurationMonths } from "../../src/sponsorships/plans";
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireTeam } from "../auth/access";
import { paidTerm, recordPayment } from "../billing/payments";
import { requireCompany } from "../organisations/mutations";
import { tiers } from "../../src/sponsorships/plans";
import { confirmationPeriod, jobFields } from "./fields";
import { normalizeEmail } from "../members/emails";
import { normalizeUrl } from "../members/urls";
import { sponsorshipTerm } from "../sponsorships/organisations";

/** Read the public job board, excluding expired or unconfirmed vacancies. */
export const list = query({
    args: { organisationId: v.optional(v.id("organisations")) },
    handler: async (ctx, args) => {
        // read published vacancies for one organisation or the entire board
        const rows = args.organisationId
            ? await ctx.db
                  .query("jobs")
                  .withIndex("by_organisation", (q) => q.eq("organisationId", args.organisationId!))
                  .filter((q) => q.eq(q.field("status"), "published"))
                  .collect()
            : await ctx.db
                  .query("jobs")
                  .withIndex("by_status", (q) => q.eq("status", "published"))
                  .collect();
        const entries = await Promise.all(rows.map((row) => publicJob(ctx, row)));

        return entries.filter((row) => row.isOpen).sort((a, b) => b.publishedAt - a.publishedAt);
    },
});

/** Read an approved job, retaining its page after applications close. */
export const detail = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query("jobs")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .unique();

        return row?.publishedAt ? await publicJob(ctx, row) : null;
    },
});

/** Save a separate job revision and optionally request editorial review. */
export const save = mutation({
    args: { id: v.optional(v.id("jobs")), submit: v.boolean(), ...jobFields },
    handler: async (ctx, args) => {
        // require access to both the current and proposed company
        await requireCompany(ctx, args.organisationId);
        const row = args.id ? await ctx.db.get(args.id) : null;
        if (args.id && !row) throw new Error("Job not found.");
        if (row) await requireCompany(ctx, row.organisationId);
        // validate public copy and the URL slug
        if (
            !args.title.trim() ||
            args.title.length > 180 ||
            !args.description.trim() ||
            args.description.length > 50000 ||
            !args.location.trim() ||
            args.location.length > 300 ||
            args.tags.length > 12 ||
            args.tags.some((tag) => tag.length > 40) ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.slug)
        )
            throw new Error(
                "Enter a title, description, location, valid URL slug and up to twelve short tags.",
            );

        // validate the optional salary range
        if (
            args.salary &&
            (!Number.isFinite(args.salary.min) ||
                !Number.isFinite(args.salary.max) ||
                args.salary.min < 0 ||
                args.salary.max < args.salary.min)
        )
            throw new Error("Enter a valid salary range in CHF.");

        // keep published company identity and URLs stable
        const collision = await ctx.db
            .query("jobs")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .unique();
        if (collision && collision._id !== args.id) throw new Error("A job already uses this URL.");
        if (
            row?.publishedAt &&
            (row.slug !== args.slug || row.organisationId !== args.organisationId)
        )
            throw new Error("A published job's company and URL cannot change.");

        // retain the public revision until the team approves the edit
        const { id, submit, ...fields } = args;
        const values = {
            ...fields,
            title: fields.title.trim(),
            billingEmail: normalizeEmail(fields.billingEmail),
            applicationUrl: normalizeUrl(fields.applicationUrl),
            tags: [...new Set(fields.tags.map((tag) => tag.trim()).filter(Boolean))],
        };
        const now = Date.now();
        if (row?.publishedAt) {
            await ctx.db.patch(row._id, {
                draft: values,
                draftStatus: submit ? "review" : "draft",
                reviewNote: undefined,
                updatedAt: now,
            });

            return row._id;
        }
        if (row) {
            await ctx.db.patch(row._id, {
                ...values,
                status: submit ? "review" : "draft",
                reviewNote: undefined,
                updatedAt: now,
            });

            return row._id;
        }
        // bound open drafts per company
        const owned = await ctx.db
            .query("jobs")
            .withIndex("by_organisation", (q) => q.eq("organisationId", args.organisationId))
            .collect();
        if (
            owned.filter((item) => item.status === "draft" || item.status === "review").length >= 20
        )
            throw new Error("Finish your existing drafts before adding more jobs.");

        return await ctx.db.insert("jobs", {
            ...values,
            status: submit ? "review" : "draft",
            createdAt: now,
            updatedAt: now,
        });
    },
});

/** Publish or renew a reviewed vacancy using a paid invoice or an included sponsor slot. */
export const publish = mutation({
    args: {
        id: v.id("jobs"),
        funding: v.union(v.literal("existing"), v.literal("invoice"), v.literal("sponsor")),
        invoiceReference: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // require team review before allocating paid publication
        const reviewer = await requireTeam(ctx);

        // require management access before changing publication state
        const row = await ctx.db.get(args.id);
        if (!row) throw new Error("Job not found.");
        const now = Date.now();
        let expiresAt = await jobExpiry(ctx, row);
        let sponsorshipId = row.sponsorshipId;

        // record a manual payment independently of hosted checkout
        if (args.funding === "invoice") {
            if (!args.invoiceReference?.trim())
                throw new Error("Enter the paid invoice reference.");
            await recordPayment(ctx, {
                reference: args.invoiceReference,
                amount: jobPrice,
                subjectId: row._id,
                memberId: (await requireCompany(ctx, row.organisationId)).organisation.ownerId,
                name: `${row.title} · ${jobDurationMonths} months`,
                recordedBy: reviewer.memberId,
                paidAt: now,
            });
            expiresAt = (await paidTerm(ctx, row._id, jobDurationMonths))!.endsAt;
            sponsorshipId = undefined;
        }
        // allocate one of the company's active sponsorship slots
        else if (args.funding === "sponsor" || (args.funding === "existing" && row.sponsorshipId)) {
            const sponsors = await ctx.db
                .query("sponsorships")
                .withIndex("by_status", (q) => q.eq("status", "active"))
                .collect();
            const terms = await Promise.all(
                sponsors.map(async (item) => ({
                    ...item,
                    term: await sponsorshipTerm(ctx, item),
                })),
            );
            const sponsor = terms.find(
                (item) =>
                    item.tier !== "patron" &&
                    item.organisationId === row.organisationId &&
                    item.term &&
                    item.term.endsAt > now,
            );
            if (!sponsor) throw new Error("This company has no active sponsorship.");
            const allowance = tiers.find((item) => item.id === sponsor.tier)!.jobs;
            const jobs = await ctx.db
                .query("jobs")
                .withIndex("by_status", (q) => q.eq("status", "published"))
                .collect();
            const used = jobs.filter(
                (item) => item._id !== row._id && item.sponsorshipId === sponsor._id,
            ).length;
            if (used >= allowance) throw new Error("All included job slots are in use.");
            sponsorshipId = sponsor._id;
            expiresAt = sponsor.term!.endsAt;
        }
        // approve an edit without changing the original paid term
        else if (!expiresAt || expiresAt <= now)
            throw new Error("Confirm payment or allocate a sponsor slot first.");
        if (!expiresAt) throw new Error("Missing job expiry.");

        // publish the approved revision and renew its freshness timestamp
        await ctx.db.patch(row._id, {
            ...(row.draft ?? {}),
            status: "published",
            draft: undefined,
            draftStatus: undefined,
            reviewNote: undefined,
            sponsorshipId,
            publishedAt: row.publishedAt ?? now,
            confirmedAt: now,
            updatedAt: now,
        });
    },
});

/** Reconfirm an open vacancy or close it without exposing unreviewed edits. */
export const updateStatus = mutation({
    args: {
        id: v.id("jobs"),
        action: v.union(v.literal("confirm"), v.literal("close"), v.literal("decline")),
        note: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // require management access before changing publication state
        const row = await ctx.db.get(args.id);
        if (!row) throw new Error("Job not found.");
        const { viewer } = await requireCompany(ctx, row.organisationId);

        // return unapproved changes to the employer with the review note
        if (args.action === "decline") {
            if (!viewer.isTeam || !args.note?.trim())
                throw new Error("Team review and a reason are required.");
            await ctx.db.patch(row._id, {
                status: row.publishedAt ? row.status : "draft",
                draftStatus: row.draft ? "draft" : undefined,
                reviewNote: args.note.trim(),
                updatedAt: Date.now(),
            });
        } else if (args.action === "close") {
            await ctx.db.patch(row._id, { status: "closed", updatedAt: Date.now() });
        } else {
            const expiresAt = await jobExpiry(ctx, row);
            if (row.status !== "published" || expiresAt === null || expiresAt <= Date.now())
                throw new Error("Renew or publish this job before confirming it.");
            await ctx.db.patch(row._id, { confirmedAt: Date.now(), updatedAt: Date.now() });
        }
    },
});

/** Resolve a public revision and its current application eligibility. */
async function publicJob(ctx: QueryCtx, row: Doc<"jobs">) {
    // require the company and publication timestamps
    const organisation = await ctx.db.get(row.organisationId);
    if (!organisation) throw new Error("Job company is missing.");
    if (!row.publishedAt || !row.confirmedAt)
        throw new Error("Published job has no publication term.");

    // derive application eligibility from funding and freshness
    const expiresAt = await jobExpiry(ctx, row);
    const now = Date.now();
    const isOpen = jobStatus(row, expiresAt, now) === "published";

    return {
        slug: row.slug,
        title: row.title,
        description: row.description,
        company: {
            name: organisation.name,
            website: organisation.website,
            logoUrl: organisation.logoUrl,
            logoDarkUrl: organisation.logoDarkUrl,
        },
        location: row.location,
        workplace: row.workplace,
        employment: row.employment,
        salary: row.salary,
        tags: row.tags,
        applicationUrl: row.applicationUrl,
        publishedAt: row.publishedAt,
        isOpen,
    };
}

/** Resolve current funding through the job's own payments or its allocated sponsor slot. */
export async function jobExpiry(
    ctx: Pick<QueryCtx, "db">,
    job: Doc<"jobs">,
): Promise<number | null> {
    // reject missing sponsorships and exclude ended agreements
    if (job.sponsorshipId) {
        const sponsor = await ctx.db.get(job.sponsorshipId);
        if (!sponsor) throw new Error("Job sponsorship is missing.");
        if (sponsor.status !== "active") return null;

        return (await sponsorshipTerm(ctx, sponsor))?.endsAt ?? null;
    }
    const term = await paidTerm(ctx, job._id, jobDurationMonths);

    return term?.endsAt ?? null;
}

/** Derive visible job status from editorial state, payment and freshness. */
export function jobStatus(
    job: Pick<Doc<"jobs">, "status" | "confirmedAt">,
    expiresAt: number | null,
    now = Date.now(),
) {
    if (job.status !== "published") return job.status;
    if (!expiresAt || expiresAt <= now) return "expired";
    if (!job.confirmedAt || job.confirmedAt + confirmationPeriod <= now) return "unconfirmed";
    return "published";
}
