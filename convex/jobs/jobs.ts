import { jobPrice, jobDurationMonths } from "../../src/sponsorships/plans";
import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { requireAdmin } from "../auth/access";
import { paidTerm, recordPayment } from "../billing/payments";
import { requireCompany } from "../organisations/mutations";
import { tiers } from "../../src/sponsorships/plans";
import { confirmationPeriod, jobFields } from "./fields";
import { normalizeEmail } from "../members/emails";
import { normalizeJob } from "./validation";
import { sponsorshipTerm } from "../sponsorships/organisations";

/** Read the public job board, excluding expired or unconfirmed vacancies. */
export const list = query({
    args: { organisationId: v.optional(v.id("organisations")) },
    handler: async (ctx, args) => {
        return await openJobs(ctx, args.organisationId);
    },
});

/** Select the same eligible vacancies for the website and newsletter. */
export async function openJobs(ctx: QueryCtx, organisationId?: Doc<"jobs">["organisationId"]) {
    // read published vacancies for one organisation or the entire board
    const rows = organisationId
        ? await ctx.db
              .query("jobs")
              .withIndex("by_organisation", (q) => q.eq("organisationId", organisationId!))
              .filter((q) => q.eq(q.field("status"), "published"))
              .collect()
        : await ctx.db
              .query("jobs")
              .withIndex("by_status", (q) => q.eq("status", "published"))
              .collect();
    const entries = await Promise.all(rows.map((row) => publicJob(ctx, row)));

    return entries.filter((row) => row.isOpen).sort((a, b) => b.publishedAt - a.publishedAt);
}

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
    args: {
        id: v.optional(v.id("jobs")),
        submit: v.boolean(),
        billingEmail: v.string(),
        ...jobFields,
    },
    handler: async (ctx, args) => {
        // require access to both the current and proposed company
        const { viewer } = await requireCompany(ctx, args.organisationId);
        const row = args.id ? await ctx.db.get(args.id) : null;
        if (args.id && !row) throw new Error("Job not found.");
        if (row) await requireCompany(ctx, row.organisationId);

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
        const { id, submit, billingEmail, ...fields } = args;
        const values = normalizeJob(fields);

        // validate topic references against the shared catalogue
        const topics = await ctx.db.query("topics").collect();
        if (values.topics.some((slug) => !topics.some((topic) => topic.slug === slug)))
            throw new Error("Select existing topics.");
        const administration = {
            billingEmail: normalizeEmail(billingEmail),
            updatedBy: viewer.memberId,
        };
        const now = Date.now();
        if (row?.publishedAt) {
            await ctx.db.patch(row._id, {
                ...administration,
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
                ...administration,
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
            ...administration,
            createdBy: viewer.memberId,
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
        const reviewer = await requireAdmin(ctx);

        // require management access before changing publication state
        const row = await ctx.db.get(args.id);
        if (!row) throw new Error("Job not found.");
        const now = Date.now();
        const revision = row.draft ?? row;
        if (revision.applicationDeadline !== undefined && revision.applicationDeadline <= now)
            throw new Error("Update the application deadline before publishing.");
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
            const allocation = await jobAllowance(ctx, row.organisationId, row._id);
            if (!allocation) throw new Error("This company has no active sponsorship.");
            if (allocation.available !== null && allocation.available < 1)
                throw new Error("All included job slots are in use.");
            sponsorshipId = allocation.id;
            expiresAt = allocation.endsAt;
        }
        // approve an edit without changing the original paid term
        else if (!expiresAt || expiresAt <= now)
            throw new Error("Confirm payment or allocate a sponsor slot first.");
        if (!expiresAt) throw new Error("Missing job expiry.");

        // publish the approved revision and renew its freshness timestamp
        await ctx.db.patch(row._id, {
            ...(row.draft ?? {}),
            updatedBy: reviewer.memberId,
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
            if (!viewer.isAdmin || !args.note?.trim())
                throw new Error("Team review and a reason are required.");
            await ctx.db.patch(row._id, {
                status: row.publishedAt ? row.status : "draft",
                draftStatus: row.draft ? "draft" : undefined,
                reviewNote: args.note.trim(),
                updatedBy: viewer.memberId,
                updatedAt: Date.now(),
            });
        } else if (args.action === "close") {
            await ctx.db.patch(row._id, {
                status: "closed",
                updatedAt: Date.now(),
                updatedBy: viewer.memberId,
            });
        } else {
            const expiresAt = await jobExpiry(ctx, row);
            if (row.status !== "published" || expiresAt === null || expiresAt <= Date.now())
                throw new Error("Renew or publish this job before confirming it.");
            if (row.applicationDeadline !== undefined && row.applicationDeadline <= Date.now())
                throw new Error("Update the application deadline before confirming.");
            if (row.sponsorshipId) {
                const allocation = await jobAllowance(ctx, row.organisationId, row._id);
                if (
                    !allocation ||
                    allocation.id !== row.sponsorshipId ||
                    (allocation.available !== null && allocation.available < 1)
                )
                    throw new Error("No sponsorship slot is available to reconfirm this job.");
            }
            await ctx.db.patch(row._id, {
                confirmedAt: Date.now(),
                updatedAt: Date.now(),
                updatedBy: viewer.memberId,
            });
        }
    },
});

/** Resolve a public revision and its current application eligibility. */
export async function publicJob(ctx: QueryCtx, row: Doc<"jobs">) {
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
        id: row._id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        company: {
            name: organisation.name,
            website: organisation.website,
            logoUrl: organisation.logoUrl,
            logoDarkUrl: organisation.logoDarkUrl,
        },
        summary: row.summary,
        locations: row.locations,
        workplace: row.workplace,
        remoteEligibility: row.remoteEligibility,
        engagement: row.engagement,
        duration: row.duration,
        workload: row.workload,
        compensation: row.compensation,
        topics: row.topics,
        skills: row.skills,
        seniority: row.seniority,
        languages: row.languages,
        visaSponsorship: row.visaSponsorship,
        application: row.application,
        applicationDeadline: row.applicationDeadline,
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
    job: Pick<Doc<"jobs">, "status" | "confirmedAt" | "applicationDeadline">,
    expiresAt: number | null,
    now = Date.now(),
) {
    if (job.status !== "published") return job.status;
    if (job.applicationDeadline !== undefined && job.applicationDeadline <= now) return "closed";
    if (!expiresAt || expiresAt <= now) return "expired";
    if (!job.confirmedAt || job.confirmedAt + confirmationPeriod <= now) return "unconfirmed";
    return "published";
}

/** Resolve current sponsor capacity, excluding the vacancy being edited or renewed. */
export async function jobAllowance(
    ctx: QueryCtx,
    organisationId: Doc<"jobs">["organisationId"],
    excludeId?: Doc<"jobs">["_id"],
) {
    // select this organisation's current agreement without scanning unrelated sponsors
    const sponsors = await ctx.db
        .query("sponsorships")
        .withIndex("by_organisation", (q) => q.eq("organisationId", organisationId))
        .collect();
    const now = Date.now();
    for (const sponsor of sponsors) {
        if (sponsor.status !== "active") continue;
        const term = await sponsorshipTerm(ctx, sponsor);
        if (!term || term.startsAt > now || term.endsAt <= now) continue;
        const limit = tiers.find((tier) => tier.id === term.tier)!.jobs;
        const jobs = await ctx.db
            .query("jobs")
            .withIndex("by_organisation", (q) => q.eq("organisationId", organisationId))
            .collect();
        const used = jobs.filter(
            (job) =>
                job._id !== excludeId &&
                job.sponsorshipId === sponsor._id &&
                jobStatus(job, term.endsAt, now) === "published",
        ).length;

        return {
            id: sponsor._id,
            tier: term.tier,
            endsAt: term.endsAt,
            limit,
            available: limit === null ? null : Math.max(0, limit - used),
        };
    }
    return null;
}
