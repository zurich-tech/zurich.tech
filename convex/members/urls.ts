import { v } from "convex/values";

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
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:")
        throw new Error("Use an HTTP or HTTPS URL.");

    return url.href;
}

/** Validate an external image URL or an image hosted by this site. */
export function normalizeImageUrl(value: string): string {
    if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;

    return normalizeUrl(value);
}
