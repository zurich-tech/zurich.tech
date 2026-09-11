/** Read a required Convex environment variable. */
export function requiredEnvironment(name: string) {
    const value = process.env[name];
    if (value === undefined || value.length === 0) {
        throw new Error(`${name} is not configured.`);
    }

    return value;
}

/** Resolve the configured public website origin. */
export function siteOrigin() {
    return requiredEnvironment("SITE_URL").replace(/\/$/, "");
}
