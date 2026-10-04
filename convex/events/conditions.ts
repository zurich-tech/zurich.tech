import { ConvexError } from "convex/values";
import type { Confirmation, Registration } from "./fields";

/** An unconditional event is confirmed without storing redundant state. */
export function isTentative(event: { confirmation?: Confirmation; confirmedAt?: number }) {
    return !!event.confirmation && event.confirmedAt === undefined;
}

/** Validate requirements against admission and the event's start. */
export function validateConfirmation(
    confirmation: Confirmation | undefined,
    registration: Registration,
    startsAt: number,
) {
    if (!confirmation) return;
    if (!Number.isFinite(confirmation.decidesAt) || confirmation.decidesAt >= startsAt)
        throw new ConvexError("Set the confirmation deadline before the event starts.");
    if (!confirmation.minimum && !confirmation.isApprovalRequired)
        throw new ConvexError("Choose a minimum turnout or team approval.");
    if (confirmation.minimum !== undefined) {
        if (!Number.isInteger(confirmation.minimum) || confirmation.minimum < 1)
            throw new ConvexError("Minimum turnout must be a positive whole number.");
        if (registration.kind !== "native")
            throw new ConvexError("Minimum turnout requires registration on zurich.tech.");
        if (registration.capacity !== null && confirmation.minimum > registration.capacity)
            throw new ConvexError("Minimum turnout cannot exceed capacity.");
    }
}

/** Compare confirmation promises independently of object property order. */
export function sameConfirmation(left?: Confirmation, right?: Confirmation) {
    return (
        left?.minimum === right?.minimum &&
        left?.isApprovalRequired === right?.isApprovalRequired &&
        left?.timing === right?.timing &&
        left?.decidesAt === right?.decidesAt
    );
}

/** Decide once, excluding signups or approvals made after the deadline. */
export function confirmationDecision(
    event: {
        confirmation?: Confirmation;
        confirmedAt?: number;
        approvedAt?: number;
    },
    registrations: { status: string; createdAt: number; approvedAt?: number }[],
    now: number,
) {
    if (!isTentative(event)) return undefined;
    const rule = event.confirmation!;
    const count = registrations.filter(
        (row) =>
            row.status === "going" &&
            row.createdAt <= rule.decidesAt &&
            (row.approvedAt ?? row.createdAt) <= rule.decidesAt,
    ).length;
    const qualifies =
        count >= (rule.minimum ?? 0) &&
        (!rule.isApprovalRequired ||
            (event.approvedAt !== undefined && event.approvedAt <= rule.decidesAt));
    if (qualifies && (rule.timing === "immediate" || now >= rule.decidesAt)) return "confirmed";
    if (now >= rule.decidesAt) return "cancelled";
    return undefined;
}
