/** Return a visible message for one caught failure. */
export function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
