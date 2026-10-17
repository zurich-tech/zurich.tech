import type { AddressAccess } from "./fields";
import { sameAddressAccess } from "./place";

type Event = {
    startsAt: number;
    endsAt?: number;
    location?: string;
    address?: string;
    addressAccess?: AddressAccess;
};

/** Attendance details that warrant an update, shared by preview, delivery and email copy. */
export function notificationChanges(previous: Event, current: Event) {
    const changes: ("Start" | "End" | "Venue" | "Address" | "Address visibility")[] = [];
    if (previous.startsAt !== current.startsAt) changes.push("Start");
    if (previous.endsAt !== current.endsAt) changes.push("End");
    if ((previous.location ?? "").trim() !== (current.location ?? "").trim()) changes.push("Venue");

    // hidden or externally hosted addresses are not attendee-facing local address changes
    const address = (event: Event) =>
        !event.addressAccess || ["public", "confirmed"].includes(event.addressAccess.kind)
            ? (event.address ?? "").trim()
            : "";
    if (address(previous) !== address(current)) changes.push("Address");
    if (!sameAddressAccess(previous.addressAccess, current.addressAccess))
        changes.push("Address visibility");

    return changes;
}
