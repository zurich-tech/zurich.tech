import { query } from "../_generated/server";
import { v } from "convex/values";
import type { AddressAccess } from "./fields";
import { permissions } from "../auth/grants";
import { allows } from "../auth/permissions";
import { authComponent } from "../auth/component";
import { normalizeEmail } from "../members/emails";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Resolve an event's venue name, postal address and map position. */
export async function eventPlace(ctx: QueryCtx, event: Doc<"events">) {
    // expand a linked venue without changing its shared address
    const venue = event.venueId ? await ctx.db.get(event.venueId) : null;
    const address = venue ? await ctx.db.get(venue.addressId) : null;
    if (event.venueId && !venue) throw new Error("Event venue is missing.");
    if (venue && !address) throw new Error("Venue address is missing.");

    return {
        location: venue?.name ?? event.location ?? "",
        address:
            event.address ??
            (address
                ? [address.line1, address.line2, address.postalCode, address.locality]
                      .filter(Boolean)
                      .join(", ")
                : ""),
        latitude: event.latitude ?? address?.latitude,
        longitude: event.longitude ?? address?.longitude,
    };
}

/** Redact private address fields before returning or rendering a venue. */
export function disclosePlace(
    place: Awaited<ReturnType<typeof eventPlace>>,
    policy?: AddressAccess,
    isConfirmed = false,
    access?: string,
) {
    const kind = policy?.kind ?? "public";
    const isVisible = kind === "public" || (kind === "confirmed" && isConfirmed);

    return {
        name: place.location,
        address: isVisible ? place.address || undefined : undefined,
        coordinates:
            isVisible && place.latitude !== undefined && place.longitude !== undefined
                ? { latitude: place.latitude, longitude: place.longitude }
                : undefined,
        access: isVisible ? access : undefined,
        availability: kind,
        url: policy?.kind === "external" ? policy.url : undefined,
        label: policy?.kind === "external" ? policy.label : undefined,
    };
}

/** Reveal an address only to a confirmed attendee or an assigned editor. */
export const get = query({
    args: { eventId: v.id("events"), token: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const event = await ctx.db.get(args.eventId);
        if (!event || event.status === "draft") return null;
        let isAllowed = false;

        // Private registration links grant access only to their own confirmed event.
        if (args.token) {
            const row = await ctx.db
                .query("registrations")
                .withIndex("by_token", (q) => q.eq("token", args.token!))
                .unique();
            isAllowed = row?.eventId === event._id && row.status === "going";
        } else {
            const access = await permissions(ctx);
            isAllowed = allows(access, { eventId: event._id, seriesId: event.seriesId }, "editor");
            if (!isAllowed) {
                const user = await authComponent.getAuthUser(ctx);
                const owned = await ctx.db
                    .query("registrations")
                    .withIndex("by_member", (q) => q.eq("memberId", access.account.memberId))
                    .collect();
                const row =
                    owned.find((row) => row.eventId === event._id) ??
                    (user.emailVerified
                        ? await ctx.db
                              .query("registrations")
                              .withIndex("by_event_and_email", (q) =>
                                  q
                                      .eq("eventId", event._id)
                                      .eq("email", normalizeEmail(user.email)),
                              )
                              .unique()
                        : null);
                isAllowed = row?.status === "going";
            }
        }

        const venue = event.venueId ? await ctx.db.get(event.venueId) : null;
        return disclosePlace(
            await eventPlace(ctx, event),
            event.addressAccess,
            isAllowed,
            venue?.accessNotes,
        );
    },
});

/** Enforce address disclosure for drafts and every publication path. */
export function validateAddress(
    event: {
        addressAccess?: AddressAccess;
        address?: string;
        registration: { kind: string };
    },
    isPublished = false,
) {
    const policy = event.addressAccess;
    if (policy?.kind === "confirmed") {
        if (event.registration.kind !== "native")
            throw new Error("Confirmed-only addresses require registration on zurich.tech.");
        if (isPublished && !event.address?.trim())
            throw new Error("Add the address for confirmed attendees before publishing.");
    }

    // External links must be ordinary web links with a readable site name.
    if (policy?.kind === "external") {
        let url: URL;
        try {
            url = new URL(policy.url);
        } catch {
            throw new Error("Enter a web address and a short site name.");
        }
        if (
            !["https:", "http:"].includes(url.protocol) ||
            url.username ||
            url.password ||
            !policy.label.trim() ||
            policy.label.length > 80
        )
            throw new Error("Enter a web address and a short site name.");
    }
}
