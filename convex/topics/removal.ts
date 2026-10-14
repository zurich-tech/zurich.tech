import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/** Catalogue keys explicitly removed from the site's taxonomy. */
const removed = new Set(["ai-safety", "ai-ethics"]);

/** Remove the rejected labels and their references without replacing user answers. */
export const apply = internalMutation({
    args: { apply: v.boolean() },
    handler: async (ctx, args) => {
        const counts: Record<string, number> = {};

        // refuse to widen email targeting by emptying a subscriber's topic selection
        const subscriptions = await ctx.db.query("subscriptions").collect();
        counts.subscriptions = subscriptions.filter((row) =>
            row.topics?.some((slug) => removed.has(slug)),
        ).length;
        if (args.apply && counts.subscriptions)
            throw new Error("Review affected subscription preferences before removing topics.");

        // clean direct topic references in published content and private revisions
        for (const table of ["events", "series", "seriesRevisions", "submissions"] as const) {
            counts[table] = 0;
            for (const row of await ctx.db.query(table).collect()) {
                if (!row.topics.some((slug) => removed.has(slug))) continue;
                counts[table]++;
                if (args.apply)
                    await ctx.db.patch(row._id, {
                        topics: row.topics.filter((slug) => !removed.has(slug)),
                    });
            }
        }

        // remove only the rejected choices from existing private survey answers
        counts.accounts = 0;
        for (const row of await ctx.db.query("accounts").collect()) {
            if (!row.interests?.some((slug) => removed.has(slug))) continue;
            counts.accounts++;
            if (args.apply)
                await ctx.db.patch(row._id, {
                    interests: row.interests.filter((slug) => !removed.has(slug)),
                });
        }

        // preserve the separation between published articles and unpublished edits
        counts.posts = 0;
        for (const row of await ctx.db.query("posts").collect()) {
            if (
                ![...row.draft.topics, ...(row.published?.topics ?? [])].some((slug) =>
                    removed.has(slug),
                )
            )
                continue;
            counts.posts++;
            if (args.apply)
                await ctx.db.patch(row._id, {
                    draft: {
                        ...row.draft,
                        topics: row.draft.topics.filter((slug) => !removed.has(slug)),
                    },
                    ...(row.published
                        ? {
                              published: {
                                  ...row.published,
                                  topics: row.published.topics.filter((slug) => !removed.has(slug)),
                              },
                          }
                        : {}),
                });
        }

        // keep job drafts and recurrence templates free of orphaned catalogue keys
        counts.jobs = 0;
        for (const row of await ctx.db.query("jobs").collect()) {
            if (![...row.topics, ...(row.draft?.topics ?? [])].some((slug) => removed.has(slug)))
                continue;
            counts.jobs++;
            if (args.apply)
                await ctx.db.patch(row._id, {
                    topics: row.topics.filter((slug) => !removed.has(slug)),
                    ...(row.draft
                        ? {
                              draft: {
                                  ...row.draft,
                                  topics: row.draft.topics.filter((slug) => !removed.has(slug)),
                              },
                          }
                        : {}),
                });
        }
        counts.schedules = 0;
        for (const row of await ctx.db.query("schedules").collect()) {
            if (!row.template.topics.some((slug) => removed.has(slug))) continue;
            counts.schedules++;
            if (args.apply)
                await ctx.db.patch(row._id, {
                    template: {
                        ...row.template,
                        topics: row.template.topics.filter((slug) => !removed.has(slug)),
                    },
                });
        }

        // delete catalogue entries only after cleaning every live reference
        counts.topics = 0;
        for (const row of await ctx.db.query("topics").collect()) {
            if (!removed.has(row.slug)) continue;
            counts.topics++;
            if (args.apply) await ctx.db.delete(row._id);
        }

        return { applied: args.apply, counts };
    },
});
