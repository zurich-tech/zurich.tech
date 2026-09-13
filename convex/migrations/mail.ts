import { internalMutation, internalQuery } from "../_generated/server";
import { isBulk, recipientsLocked } from "../mail/policy";

/** Copy legacy email records without deleting sources or changing recipient restrictions. */
export const copy = internalMutation({
    args: {},
    handler: async (ctx) => {
        // require a locked, paused deployment before moving queued work
        if (!recipientsLocked())
            throw new Error("Keep MAIL_RECIPIENTS configured during migration.");
        const previous = await ctx.db.query("mailSettings").unique();
        if (previous && !previous.isPaused) throw new Error("Pause bulk delivery first.");
        const schedule = await ctx.db.query("digests").unique();
        if (schedule && !schedule.isPaused) throw new Error("Pause the newsletter first.");

        // preserve stable keys, provider identifiers, rendered content and terminal results
        let copied = 0;
        for (const row of await ctx.db.query("deliveries").collect()) {
            const existing = await ctx.db
                .query("messages")
                .withIndex("by_key", (q) => q.eq("key", row.key))
                .unique();
            if (existing) {
                if (
                    existing.to !== row.to ||
                    existing.subject !== row.subject ||
                    existing.text !== row.text ||
                    existing.html !== row.html ||
                    existing.key !== row.key ||
                    (row.providerId && existing.providerId !== row.providerId)
                )
                    throw new Error(
                        "Migration conflicts with an existing message. Review before continuing.",
                    );
                continue;
            }
            const { _id, _creationTime, status, ...fields } = row;
            await ctx.db.insert("messages", {
                ...fields,
                isBulk: isBulk(row.category),
                status:
                    status === "sent"
                        ? "accepted"
                        : status === "failed" && row.attempts < 5
                          ? "queued"
                          : status,
                nextAttemptAt: row.nextAttemptAt ?? row.createdAt,
            });
            copied++;
        }

        // keep provider event identities so webhook replay remains harmless
        for (const { _id, _creationTime, ...row } of await ctx.db.query("mailEvents").collect()) {
            const existing = await ctx.db
                .query("deliveryEvents")
                .withIndex("by_provider_event", (q) => q.eq("providerEventId", row.providerEventId))
                .unique();
            if (!existing) await ctx.db.insert("deliveryEvents", row);
        }

        // retain pauses and counters without activating any schedule
        if (!(await ctx.db.query("mailPolicy").unique()))
            await ctx.db.insert("mailPolicy", {
                isPaused: true,
                profile: previous?.profile ?? "new",
                pauseReason: previous?.pauseReason,
            });
        if (!(await ctx.db.query("mailQuota").unique()))
            await ctx.db.insert("mailQuota", {
                day: previous?.day ?? 0,
                date: previous?.date ?? "",
                count: previous?.count ?? 0,
                nextAt: previous?.nextAt ?? 0,
                accepted: previous?.accepted ?? 0,
                bounced: previous?.bounced ?? 0,
                complained: previous?.complained ?? 0,
            });
        if (!(await ctx.db.query("mailSchedules").unique()))
            await ctx.db.insert("mailSchedules", {
                isPaused: true,
                lastWeek: schedule?.lastWeek,
            });

        // supply explicit defaults to existing written drafts
        for (const campaign of await ctx.db.query("campaigns").collect()) {
            if (!campaign.audience)
                await ctx.db.patch(campaign._id, {
                    audience: { kind: "subscribers" },
                    category: "campaign",
                });
        }
        return {
            copied,
            legacy: (await ctx.db.query("deliveries").collect()).length,
            messages: (await ctx.db.query("messages").collect()).length,
        };
    },
});

/** Verify migration in place without exporting recipient addresses or email bodies. */
export const check = internalQuery({
    args: {},
    handler: async (ctx) => {
        const legacy = await ctx.db.query("deliveries").collect();
        const messages = await ctx.db.query("messages").collect();
        const byKey = new Map(messages.map((row) => [row.key, row]));
        const missing = legacy.filter((row) => !byKey.has(row.key)).length;
        const changed = legacy.filter((row) => {
            const copy = byKey.get(row.key);
            return (
                copy &&
                (copy.to !== row.to ||
                    copy.subject !== row.subject ||
                    copy.text !== row.text ||
                    copy.html !== row.html ||
                    (row.providerId && copy.providerId !== row.providerId))
            );
        }).length;
        const jobs = await ctx.db.system
            .query("_scheduled_functions")
            .filter((q) =>
                q.or(
                    q.eq(q.field("state.kind"), "pending"),
                    q.eq(q.field("state.kind"), "inProgress"),
                ),
            )
            .collect();
        return {
            legacy: legacy.length,
            messages: messages.length,
            missing,
            changed,
            legacyJobs: jobs.filter((job) => /mail\/(deliveries|digests|rollout)/.test(job.name))
                .length,
            isLocked: recipientsLocked(),
            isPaused: (await ctx.db.query("mailPolicy").unique())?.isPaused ?? true,
            newsletterPaused: (await ctx.db.query("mailSchedules").unique())?.isPaused ?? true,
            acceptedTests: messages.filter(
                (row) => row.key.startsWith("test:") && row.status === "accepted",
            ).length,
        };
    },
});
