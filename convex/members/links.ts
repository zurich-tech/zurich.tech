import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { normalizeUrl } from "./urls";

type Owner = Doc<"links">["ownerId"];
type Profiles = {
    profileUrl?: string;
    socials?: {
        linkedin?: string;
        github?: string;
        x?: string;
        website?: string;
        discord?: string;
    };
};

/** Read ordered links with an explicit visibility boundary. */
export async function readLinks(
    ctx: Pick<QueryCtx, "db">,
    ownerId: Owner,
    visibility: "public" | "all" = "public",
) {
    const rows = await ctx.db
        .query("links")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect();
    return rows
        .filter((row) => visibility === "all" || row.visibility === "public")
        .sort((a, b) => a.position - b.position);
}

/** Present typed public links to profile and recognition components. */
export async function readProfiles(
    ctx: Pick<QueryCtx, "db">,
    ownerId: Owner,
    visibility: "public" | "all" = "public",
): Promise<Profiles> {
    const links = await readLinks(ctx, ownerId, visibility);

    return presentProfiles(links);
}

/** Present already ordered, visibility-filtered profile links. */
export function presentProfiles(links: Doc<"links">[]): Profiles {
    const socials: NonNullable<Profiles["socials"]> = {};
    for (const link of links) {
        if (
            link.kind === "linkedin" ||
            link.kind === "github" ||
            link.kind === "x" ||
            link.kind === "website" ||
            link.kind === "discord"
        )
            socials[link.kind] = link.url;
    }
    return { profileUrl: links.find((link) => link.kind === "profile")?.url, socials };
}

/** Replace the editable profile destinations while retaining other link types. */
export async function writeProfiles(ctx: MutationCtx, ownerId: Owner, profile: Profiles) {
    const existing = await readLinks(ctx, ownerId, "all");
    const destinations = { profile: profile.profileUrl, ...profile.socials };
    const kinds = ["profile", "linkedin", "github", "x"] as const;
    for (const [position, kind] of kinds.entries()) {
        const url = destinations[kind]?.trim();
        const rows = existing.filter((row) => row.kind === kind);
        const values = {
            ownerId,
            kind,
            url: url ? normalizeUrl(url) : "",
            position,
            visibility: "public" as const,
            updatedAt: Date.now(),
        };
        if (url) {
            if (rows[0]) await ctx.db.patch(rows[0]._id, values);
            else await ctx.db.insert("links", { ...values, createdAt: Date.now() });
        }
        for (const row of rows.slice(url ? 1 : 0)) await ctx.db.delete(row._id);
    }
}

/** Identify the destination platform without changing the supplied URL. */
export function linkKind(url: string): Doc<"links">["kind"] {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (hostname === "github.com") return "github";
    if (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) return "linkedin";
    if (hostname === "x.com" || hostname === "twitter.com") return "x";
    return "website";
}

/** Store an ordered speaker link list in the same model as other public profiles. */
export async function writeLinks(ctx: MutationCtx, ownerId: Owner, urls: string[]) {
    const existing = await readLinks(ctx, ownerId, "all");
    for (const row of existing) await ctx.db.delete(row._id);
    for (const [position, value] of [...new Set(urls)].entries()) {
        const url = normalizeUrl(value);
        await ctx.db.insert("links", {
            ownerId,
            kind: linkKind(url),
            url,
            position,
            visibility: "public",
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    }
}

/** Read the public links attached to one record. */
export async function publicLinks(ctx: QueryCtx, subjectId: Id<"members"> | Id<"events">) {
    const links = await ctx.db
        .query("links")
        .withIndex("by_owner", (query) => query.eq("ownerId", subjectId))
        .filter((query) => query.eq(query.field("visibility"), "public"))
        .collect();

    return links
        .sort((left, right) => left.position - right.position)
        .map((link) => ({
            href: link.url,
            label: link.label ?? link.kind,
        }));
}
