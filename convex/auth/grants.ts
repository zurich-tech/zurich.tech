import { ConvexError } from "convex/values";
import { allows, canCreate, type Role } from "./permissions";
import { requireAccount } from "./access";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

type Context = QueryCtx | MutationCtx;

/** Read authority once for a private request. */
export async function permissions(ctx: Context) {
    const account = await requireAccount(ctx);
    const grants = await ctx.db
        .query("accessGrants")
        .withIndex("by_account", (q) => q.eq("accountId", account._id))
        .collect();
    return { account, isAdmin: !!account.isAdmin, isTeam: account.isTeam, grants };
}

/** Enter the workspace without granting authority over unrelated records. */
export async function requireWorkspace(ctx: Context) {
    const access = await permissions(ctx);
    if (!access.isAdmin && !access.isTeam && !access.grants.length)
        throw new ConvexError("Editing access is required.");
    return access;
}

/** Authorise an existing event through its current series or direct assignment. */
export async function requireEvent(ctx: Context, eventId: Id<"events">, role: Role = "organiser") {
    const access = await permissions(ctx);
    const event = await ctx.db.get(eventId);
    if (!event || !allows(access, { eventId, seriesId: event.seriesId }, role))
        throw new ConvexError("You do not have access to this event.");
    return access.account;
}

/** Creating standalone series requires administrative authority. */
export async function requireSeries(
    ctx: Context,
    seriesId: Id<"series"> | undefined,
    role: Role = "organiser",
) {
    const access = await permissions(ctx);
    if (!allows(access, { seriesId }, role))
        throw new ConvexError("You do not have access to this series.");
    return access.account;
}

/** Check both the original scope and destination so moving a record cannot grant access. */
export async function requireRevision(
    ctx: Context,
    draft: Doc<"submissions"> | null,
    seriesId: Id<"series"> | undefined,
    role: Role,
) {
    const access = await permissions(ctx);
    const event = draft?.eventId ? await ctx.db.get(draft.eventId) : null;
    if (draft?.eventId && !event) throw new ConvexError("Event not found.");
    const original = event ? event.seriesId : draft?.seriesId;
    if (draft && !allows(access, { eventId: draft.eventId, seriesId: original }, role))
        throw new ConvexError("You do not have access to this event.");
    if (
        (!draft || seriesId !== original) &&
        !(role === "editor" && access.isTeam) &&
        !canCreate(access, seriesId)
    )
        throw new ConvexError("Organiser access to the destination series is required.");
    return access.account;
}

/** Read team content or assigned events without including attendee records. */
export async function scopedEvents(ctx: Context, access: Awaited<ReturnType<typeof permissions>>) {
    if (access.isAdmin || access.isTeam) return await ctx.db.query("events").collect();
    const groups = await Promise.all(
        access.grants.map(async ({ scope }) => {
            if (scope.kind === "series")
                return await ctx.db
                    .query("events")
                    .withIndex("by_series", (q) => q.eq("seriesId", scope.id))
                    .collect();
            const event = await ctx.db.get(scope.id);
            return event ? [event] : [];
        }),
    );
    return [...new Map(groups.flat().map((event) => [event._id, event])).values()];
}

/** Draft access follows the live event's scope; unpublished series drafts use their series. */
export async function scopedRevisions(
    ctx: Context,
    access: Awaited<ReturnType<typeof permissions>>,
    events: Doc<"events">[],
) {
    if (access.isAdmin || access.isTeam) return await ctx.db.query("submissions").collect();
    const groups = await Promise.all([
        ...events.map((event) =>
            ctx.db
                .query("submissions")
                .withIndex("by_event", (q) => q.eq("eventId", event._id))
                .collect(),
        ),
        ...access.grants
            .filter((grant) => grant.scope.kind === "series")
            .map((grant) =>
                ctx.db
                    .query("submissions")
                    .withIndex("by_series", (q) => q.eq("seriesId", grant.scope.id as Id<"series">))
                    .filter((q) => q.eq(q.field("eventId"), undefined))
                    .collect(),
            ),
    ]);
    return [...new Map(groups.flat().map((draft) => [draft._id, draft])).values()];
}

/** Authorise attendee operations against the registration's actual event. */
export async function requireRegistration(ctx: Context, id: Id<"registrations">) {
    const registration = await ctx.db.get(id);
    if (!registration) throw new ConvexError("Registration not found.");
    return await requireEvent(ctx, registration.eventId);
}

/** Schedules belong to their series rather than an individual occurrence. */
export async function requireSchedule(ctx: Context, id: Id<"schedules">) {
    const schedule = await ctx.db.get(id);
    if (!schedule) throw new ConvexError("Schedule not found.");
    return await requireSeries(ctx, schedule.seriesId);
}
