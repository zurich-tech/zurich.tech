import { v } from "convex/values";
import { mutation, query, internalQuery, httpAction, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { requireEvent, requireRegistration } from "../auth/grants";
import { isTentative } from "./conditions";
import qrcode from "qrcode-generator";

/** Identify a pass without granting access to the registration management link. */
export async function ensureToken(ctx: MutationCtx, row: Doc<"registrations">) {
    if (row.checkInToken) return row.checkInToken;
    const token = crypto.randomUUID() + crypto.randomUUID();
    await ctx.db.patch(row._id, { checkInToken: token });
    return token;
}

/** Encode only the independent check-in credential. */
export function passImage(token: string) {
    const code = qrcode(0, "M");
    code.addData(`zurich.tech:checkin:${token}`);
    code.make();
    return code.createDataURL(6, 24);
}

/** Read a pass through the private registration link. */
export const pass = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query("registrations")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();
        if (!row) throw new Error("Registration not found.");
        const event = await ctx.db.get(row.eventId);
        if (
            !event ||
            !event.checkIn?.isEnabled ||
            row.status !== "going" ||
            event.status === "cancelled" ||
            event.status === "draft" ||
            isTentative(event)
        )
            return null;
        return {
            image: passImage(await ensureToken(ctx, row)),
            name: row.name,
            title: event.title,
        };
    },
});

/** Read a team's check-in roster without exposing private credentials. */
export const roster = query({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        await requireEvent(ctx, args.eventId);
        const event = await ctx.db.get(args.eventId);
        if (!event) throw new Error("Event not found.");
        const rows = await ctx.db
            .query("registrations")
            .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
            .collect();
        const attendance = await ctx.db
            .query("attendances")
            .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
            .collect();
        const arrivals = new Map(attendance.map((row) => [row.registrationId, row.checkedInAt]));
        return {
            title: event.title,
            slug: event.slug,
            isEnabled: !!event.checkIn?.isEnabled,
            venueCapacity: event.venueCapacity,
            rows: rows.map((row) => ({
                id: row._id,
                name: row.name,
                email: row.email,
                status: row.status,
                checkedInAt: arrivals.get(row._id),
            })),
        };
    },
});

/** Atomically record one arrival, treating repeated scans as successful duplicates. */
export const record = mutation({
    args: {
        eventId: v.id("events"),
        token: v.optional(v.string()),
        registrationId: v.optional(v.id("registrations")),
    },
    handler: async (ctx, args) => {
        const viewer = await requireEvent(ctx, args.eventId);
        if (!!args.token === !!args.registrationId)
            throw new Error("Choose a pass or registration.");
        const row = args.registrationId
            ? await ctx.db.get(args.registrationId)
            : await ctx.db
                  .query("registrations")
                  .withIndex("by_check_in_token", (q) => q.eq("checkInToken", args.token))
                  .unique();
        if (!row) throw new Error("Invalid pass.");
        if (row.eventId !== args.eventId) throw new Error("Wrong event.");
        const event = await ctx.db.get(args.eventId);
        if (!event?.checkIn?.isEnabled) throw new Error("Check-in is disabled.");
        if (event.status === "cancelled" || event.status === "draft" || isTentative(event))
            throw new Error("Event is not confirmed.");
        if (row.status !== "going") throw new Error("Registration is not confirmed.");

        // an indexed read makes simultaneous scans conflict and retry safely
        const existing = await ctx.db
            .query("attendances")
            .withIndex("by_registrationId", (q) => q.eq("registrationId", row._id))
            .unique();
        if (existing) return { name: row.name, isDuplicate: true };
        if (event.venueCapacity !== undefined) {
            const attendance = await ctx.db
                .query("attendances")
                .withIndex("by_event", (q) => q.eq("eventId", event._id))
                .collect();
            if (attendance.length >= event.venueCapacity)
                throw new Error("Venue capacity reached. No further check-ins allowed.");
        }
        const now = Date.now();
        await ctx.db.insert("attendances", {
            eventId: event._id,
            registrationId: row._id,
            memberId: row.memberId,
            email: row.email,
            checkedInByMemberId: viewer.memberId,
            checkedInAt: now,
            method: args.token ? "qr" : "manual",
            createdAt: now,
        });
        return { name: row.name, isDuplicate: false };
    },
});

/** Undo an incorrectly recorded arrival without changing admission. */
export const undo = mutation({
    args: { registrationId: v.id("registrations") },
    handler: async (ctx, args) => {
        await requireRegistration(ctx, args.registrationId);
        const row = await ctx.db
            .query("attendances")
            .withIndex("by_registrationId", (q) => q.eq("registrationId", args.registrationId))
            .unique();
        if (row) await ctx.db.delete(row._id);
    },
});

/** Validate a bearer pass before serving its email image. */
export const imageToken = internalQuery({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const row = await ctx.db
            .query("registrations")
            .withIndex("by_check_in_token", (q) => q.eq("checkInToken", args.token))
            .unique();
        if (!row || row.status !== "going") return false;
        const event = await ctx.db.get(row.eventId);
        return (
            !!event?.checkIn?.isEnabled &&
            event.status !== "cancelled" &&
            event.status !== "draft" &&
            !isTentative(event)
        );
    },
});

/** Serve a QR image directly to email clients, without any third-party QR service. */
export const image = httpAction(async (ctx, request) => {
    const token = new URL(request.url).searchParams.get("token");
    if (
        !token ||
        token.length > 150 ||
        !(await ctx.runQuery(internal.events.checkin.imageToken, { token }))
    )
        return new Response("Not found", { status: 404 });
    const bytes = Uint8Array.from(atob(passImage(token).split(",")[1]), (char) =>
        char.charCodeAt(0),
    );
    return new Response(bytes, {
        headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
        },
    });
});
