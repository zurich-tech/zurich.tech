import { ConvexError, v } from "convex/values";

/** Optional public social accounts shared by members and organisations. */
export const socialLinks = v.object({
    linkedin: v.optional(v.string()),
    github: v.optional(v.string()),
    x: v.optional(v.string()),
});

/** Validate and trim each supplied social destination. */
export function normalizeSocialLinks(links?: { linkedin?: string; github?: string; x?: string }) {
    return {
        linkedin: links?.linkedin?.trim() ? normalizeUrl(links.linkedin.trim()) : undefined,
        github: links?.github?.trim() ? normalizeUrl(links.github.trim()) : undefined,
        x: links?.x?.trim() ? normalizeUrl(links.x.trim()) : undefined,
    };
}

/** Validate a public HTTP link. */
export function normalizeUrl(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new ConvexError("Enter a valid HTTP or HTTPS URL.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:")
        throw new ConvexError("Use an HTTP or HTTPS URL.");

    return url.href;
}

/** Validate an external image URL or an image hosted by this site. */
export function normalizeImageUrl(value: string): string {
    if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;

    return normalizeUrl(value);
}
