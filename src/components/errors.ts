import { ConvexError } from "convex/values";

/** Return a public validation message without exposing server diagnostics. */
export function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof ConvexError && typeof error.data === "string") return error.data;
    if (!(error instanceof Error) || !error.message || error.message.includes("[Request ID:"))
        return fallback;

    return error.message;
}
