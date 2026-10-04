import { ConvexError } from "convex/values";
const maximumEmailLength = 254;

/** Normalize and validate one email address. */
export function normalizeEmail(value: string): string {
    const email = value.trim().toLowerCase();

    // reject malformed or unreasonably large addresses
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValid || email.length > maximumEmailLength) {
        throw new ConvexError("Enter a valid email address.");
    }

    return email;
}
