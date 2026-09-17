/** Browsers report failed module imports differently; ordinary application errors stay separate. */
export function isModuleLoadError(error: unknown): boolean {
    return (
        error instanceof Error &&
        /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
            error.message,
        )
    );
}
