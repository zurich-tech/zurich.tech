import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { addressAccess } from "../events/fields";
import { validateAddress } from "../events/place";
import { validatePrimaryOrganiser } from "../events/organisers";
import { recipientsLocked } from "../mail/policy";

/** Apply reviewed historical corrections without invoking publication or sending mail. */
export const apply = internalMutation({
    args: {
        apply: v.boolean(),
        series: v.array(
            v.object({ slug: v.string(), primary: v.string(), others: v.array(v.string()) }),
        ),
        events: v.array(
            v.object({
                slug: v.string(),
                fields: v.object({
                    title: v.optional(v.string()),
                    number: v.optional(v.number()),
                    summary: v.optional(v.string()),
                    description: v.optional(v.string()),
                    location: v.optional(v.string()),
                    address: v.optional(v.string()),
                    addressAccess: v.optional(addressAccess),
                }),
                unset: v.optional(
                    v.array(
                        v.union(
                            v.literal("venueId"),
                            v.literal("latitude"),
                            v.literal("longitude"),
                        ),
                    ),
                ),
                agenda: v.optional(v.array(v.object({ time: v.string(), title: v.string() }))),
            }),
        ),
    },
    handler: async (ctx, args) => {
        // Keep the existing rollout restrictions intact, even for a data-only correction.
        const policy = await ctx.db.query("mailPolicy").unique();
        const schedule = await ctx.db.query("mailSchedules").unique();
        if (!recipientsLocked() || policy?.isPaused === false || schedule?.isPaused === false)
            throw new Error("Keep test delivery locked and bulk delivery paused during rollout.");

        // Resolve each public handle in this deployment; IDs are never copied across environments.
        const handles = [...new Set(args.series.flatMap((item) => [item.primary, ...item.others]))];
        const members = new Map<string, Id<"members">>();
        for (const name of handles) {
            const handle = await ctx.db
                .query("handles")
                .withIndex("by_name", (q) => q.eq("name", name))
                .unique();
            if (!handle || handle.status !== "active")
                throw new Error(`Missing public profile: ${name}`);
            await validatePrimaryOrganiser(ctx, handle.memberId);
            members.set(name, handle.memberId);
        }

        // Series defaults propagate to all events which have no explicit override.
        for (const item of args.series) {
            const series = await ctx.db
                .query("series")
                .filter((q) => q.eq(q.field("slug"), item.slug))
                .unique();
            if (!series) throw new Error(`Missing series: ${item.slug}`);
            const revision = await ctx.db
                .query("seriesRevisions")
                .filter((q) => q.eq(q.field("seriesId"), series._id))
                .first();
            if (revision) throw new Error(`Review the pending series revision first: ${item.slug}`);
            const fields = {
                primaryOrganiserId: members.get(item.primary)!,
                coOrganiserIds: item.others.map((name) => members.get(name)!),
            };
            if (args.apply) await ctx.db.patch(series._id, fields);
        }

        // Only named fields change; preserve registrations, ownership, permissions and event state.
        for (const item of args.events) {
            const event = await ctx.db
                .query("events")
                .withIndex("by_slug", (q) => q.eq("slug", item.slug))
                .unique();
            if (!event) throw new Error(`Missing event: ${item.slug}`);
            const revisions = await ctx.db
                .query("submissions")
                .filter((q) => q.eq(q.field("eventId"), event._id))
                .collect();
            if (revisions.some((row) => row.status !== "published"))
                throw new Error(`Review the pending event revision first: ${item.slug}`);
            validateAddress({ ...event, ...item.fields }, true);
            if (!args.apply) continue;
            const removed = Object.fromEntries((item.unset ?? []).map((key) => [key, undefined]));
            await ctx.db.patch(event._id, { ...item.fields, ...removed, updatedAt: Date.now() });

            // Refresh clean editor copies so later edits cannot restore superseded details.
            const { number: _number, ...authored } = item.fields;
            for (const revision of revisions)
                await ctx.db.patch(revision._id, {
                    ...authored,
                    ...Object.fromEntries(
                        (item.unset ?? [])
                            .filter((key) => key !== "venueId")
                            .map((key) => [key, undefined]),
                    ),
                    ...(item.agenda ? { agenda: item.agenda } : {}),
                    updatedAt: Date.now(),
                });

            // Replace only the explicitly supplied programme, retaining its display order.
            if (item.agenda) {
                for (const session of await ctx.db
                    .query("sessions")
                    .withIndex("by_event", (q) => q.eq("eventId", event._id))
                    .collect())
                    await ctx.db.delete(session._id);
                for (const [position, session] of item.agenda.entries())
                    await ctx.db.insert("sessions", {
                        eventId: event._id,
                        ...session,
                        position,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    });
            }
        }
        return {
            applied: args.apply,
            series: args.series.map((item) => item.slug),
            events: args.events.map((item) => item.slug),
            testLock: true,
            bulkPaused: true,
        };
    },
});
