import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { requireEvent } from "../auth/grants";
import { requireAdmin } from "../auth/access";
import { aggregateAudience } from "../members/audience";
import type { Doc } from "../_generated/dataModel";

/** Read aggregate survey progress for the event's current confirmed registrations. */
export const report = query({
    args: { slug: v.string(), results: v.boolean() },
    handler: async (ctx, args) => {
        const event = await ctx.db
            .query("events")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .unique();
        if (!event) throw new ConvexError("event not found");
        // publish counts for published events while protecting drafts and survey answers
        if (args.results) await requireAdmin(ctx);
        else if (event.status === "draft") await requireEvent(ctx, event._id);

        // resolve historical email-only registrations through the member directory
        const registrations = (
            await ctx.db
                .query("registrations")
                .withIndex("by_event", (q) => q.eq("eventId", event._id))
                .collect()
        ).filter((row) => row.status === "going");
        const members = await Promise.all(
            registrations.map(
                async (row) =>
                    row.memberId ??
                    (
                        await ctx.db
                            .query("emails")
                            .withIndex("by_email", (q) => q.eq("email", row.email))
                            .unique()
                    )?.memberId,
            ),
        );
        const accounts = (
            await Promise.all(
                [...new Set(members.filter((member) => member !== undefined))].map((memberId) =>
                    ctx.db
                        .query("accounts")
                        .withIndex("by_member", (q) => q.eq("memberId", memberId))
                        .unique(),
                ),
            )
        ).filter(
            (account): account is Doc<"accounts"> =>
                account !== null && account.status === "active",
        );
        const completed = accounts.filter(
            (account) => account.surveyCompletedAt !== undefined,
        ).length;

        // return all answer counts to administrators
        const aggregate = args.results ? await aggregateAudience(ctx, accounts) : undefined;
        const questions = aggregate?.questions.map((question) => ({
            label: question.label,
            responses: question.responses,
            groups: question.groups.filter((group) => group.count > 0),
        }));

        const registered = new Set(
            members.map((member, index) => member ?? registrations[index].email),
        ).size;

        return { title: event.title, registered, completed, questions };
    },
});
