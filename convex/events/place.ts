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
