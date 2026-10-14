import { v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { normalizeUrl, socialLinks } from "../members/urls";
import { organisationKind } from "./kinds";
import { validateSpecificTopics } from "../topics/queries";
import { normalizeHeadline } from "./headlines";

/** Reviewed profile fields shared by existing and new office addresses. */
const profile = {
    name: v.string(),
    slug: v.string(),
    kind: organisationKind,
    headline: v.string(),
    description: v.string(),
    website: v.string(),
    location: v.string(),
    office: v.string(),
    sources: v.array(v.string()),
    mapLogoUrl: v.optional(v.string()),
    socials: v.optional(socialLinks),
    topics: v.optional(v.array(v.string())),
};

/** Import reviewed organisations and public offices atomically through the deployment CLI. */
export const apply = internalMutation({
    args: {
        apply: v.boolean(),
        organisations: v.array(
            v.union(
                v.object({ ...profile, addressId: v.id("addresses") }),
                v.object({
                    ...profile,
                    address: v.object({
                        line1: v.string(),
                        locality: v.string(),
                        postalCode: v.string(),
                        countryCode: v.string(),
                        latitude: v.number(),
                        longitude: v.number(),
                        source: v.string(),
                    }),
                }),
            ),
        ),
    },
    handler: async (ctx, args) => {
        // bound each reviewed transaction and load the small directory once
        if (!args.organisations.length || args.organisations.length > 100)
            throw new Error("Import between 1 and 100 reviewed organisations.");
        const existing = await ctx.db.query("organisations").collect();
        const names = new Set(existing.map((row) => normalizeName(row.name)));
        const domains = new Set(existing.map((row) => domain(row.website)));
        const slugs = new Set(existing.map((row) => row.slug));
        const result: string[] = [];

        // index only addresses published by existing organisations, never private addresses
        const owners = new Set<string>(existing.map((row) => row._id));
        const locations = await ctx.db.query("locations").collect();
        const publicIds = new Set(
            locations
                .filter((row) => row.visibility === "public" && owners.has(row.ownerId))
                .map((row) => row.addressId),
        );
        const addresses = new Map<
            Id<"addresses">,
            Pick<Doc<"addresses">, "countryCode" | "latitude" | "longitude">
        >();
        const matches = new Map<string, Id<"addresses">>();
        for (const addressId of publicIds) {
            const address = await ctx.db.get(addressId);
            if (address) {
                addresses.set(addressId, address);
                matches.set(addressKey(address), addressId);
            }
        }

        // validate every record during both preview and application
        for (const row of args.organisations) {
            const { office, sources, socials, ...input } = row;
            const {
                addressId: existingId,
                address: reviewed,
                ...fields
            } = {
                addressId: undefined,
                address: undefined,
                ...input,
            };
            const name = fields.name.trim();
            const website = normalizeUrl(fields.website);
            if (
                !name ||
                name.length > 160 ||
                !normalizeHeadline(fields.headline) ||
                fields.headline.length > 160 ||
                !fields.description.trim() ||
                fields.description.length > 5000 ||
                !fields.location.trim() ||
                !office.trim() ||
                !sources.length ||
                !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug)
            )
                throw new Error(`Invalid organisation: ${row.slug}.`);
            for (const source of sources) normalizeUrl(source);

            // validate branding and social destinations identically in preview and application
            if (fields.mapLogoUrl !== undefined) hostedLogo(fields.mapLogoUrl, fields.slug);
            const links = reviewedSocials(socials);
            if (fields.topics !== undefined) await validateSpecificTopics(ctx, fields.topics);

            // refuse aliases and repeated records rather than overwrite curated profiles
            const key = normalizeName(name);
            const hostname = domain(website);
            if (names.has(key) || domains.has(hostname) || slugs.has(fields.slug))
                throw new Error(
                    `Possible duplicate organisation: ${name}. Review the existing record.`,
                );
            names.add(key);
            domains.add(hostname);
            slugs.add(fields.slug);

            // require explicit evidence and Swiss coordinates before matching a reviewed address
            if (reviewed) {
                if (
                    !reviewed.line1.trim() ||
                    !reviewed.locality.trim() ||
                    !/^[1-9][0-9]{3}$/.test(reviewed.postalCode.trim()) ||
                    !isSwissAddress(reviewed)
                )
                    throw new Error(`Invalid reviewed Swiss address: ${name}.`);
                normalizeUrl(reviewed.source);
            }
            let addressId = existingId ?? (reviewed && matches.get(addressKey(reviewed)));
            const address = addressId && addresses.get(addressId);
            if (addressId && (!address || !isSwissAddress(address)))
                throw new Error(`A public geocoded organisation address is required: ${name}.`);

            // create the profile and its map location atomically without notifications
            if (args.apply) {
                if (!addressId && reviewed) {
                    const { source, ...fields } = reviewed;
                    const now = Date.now();
                    addressId = await ctx.db.insert("addresses", {
                        ...fields,
                        line1: fields.line1.trim(),
                        locality: fields.locality.trim(),
                        postalCode: fields.postalCode.trim(),
                        createdAt: now,
                        updatedAt: now,
                    });
                    addresses.set(addressId, reviewed);
                    matches.set(addressKey(reviewed), addressId);
                }
                if (!addressId) throw new Error(`Missing office address: ${name}.`);
                const ownerId = await ctx.db.insert("organisations", {
                    ...fields,
                    name,
                    website,
                    headline: normalizeHeadline(fields.headline),
                    updatedAt: Date.now(),
                });
                await ctx.db.insert("locations", {
                    ownerId,
                    addressId,
                    name: office.trim(),
                    visibility: "public",
                });

                // publish verified social links in the same transaction as the branded profile
                for (const link of links)
                    await ctx.db.insert("links", {
                        ...link,
                        ownerId,
                        visibility: "public",
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    });
            }
            result.push(fields.slug);
        }

        return { applied: args.apply, count: result.length, slugs: result };
    },
});

/** Preview or remove trailing full stops from existing organisation headlines. */
export const cleanHeadlines = internalMutation({
    args: { apply: v.boolean() },
    handler: async (ctx, { apply }) => {
        // change only the headline, preserving descriptions and all other profile fields
        const organisations = await ctx.db.query("organisations").collect();
        const slugs: string[] = [];
        for (const organisation of organisations) {
            if (organisation.headline === undefined) continue;
            const headline = normalizeHeadline(organisation.headline) || undefined;
            if (headline === organisation.headline) continue;
            slugs.push(organisation.slug);
            if (apply) await ctx.db.patch(organisation._id, { headline, updatedAt: Date.now() });
        }

        return { applied: apply, count: slugs.length, slugs };
    },
});

/** Apply reviewed kinds and subjects only while the expected identity and assignments match. */
export const classify = internalMutation({
    args: {
        apply: v.boolean(),
        organisations: v.array(
            v.object({
                slug: v.string(),
                name: v.optional(v.string()),
                website: v.string(),
                expectedKind: organisationKind,
                kind: organisationKind,
                expectedTopics: v.optional(v.array(v.string())),
                topics: v.array(v.string()),
                reason: v.string(),
                sources: v.array(v.string()),
                confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
            }),
        ),
    },
    handler: async (ctx, args) => {
        // require a bounded batch with distinct reviewed identities
        if (!args.organisations.length || args.organisations.length > 100)
            throw new Error("Classify between 1 and 100 reviewed organisations.");
        const slugs = new Set<string>();
        const result = { applied: args.apply, updated: 0, unchanged: 0 };
        for (const row of args.organisations) {
            if (slugs.has(row.slug)) throw new Error(`Repeated organisation: ${row.slug}.`);
            slugs.add(row.slug);
            if (!row.reason.trim() || !row.sources.length)
                throw new Error(`Classification evidence is required: ${row.slug}.`);
            for (const source of row.sources) normalizeUrl(source);
            const organisation = await ctx.db
                .query("organisations")
                .withIndex("by_slug", (q) => q.eq("slug", row.slug))
                .unique();
            if (
                !organisation ||
                (row.name !== undefined && organisation.name !== row.name) ||
                normalizeUrl(organisation.website) !== normalizeUrl(row.website)
            )
                throw new Error(`Organisation identity changed: ${row.slug}.`);

            // require an explicit expected kind and optional exact prior subjects for corrections
            if (organisation.kind !== row.expectedKind)
                throw new Error(`Organisation kind changed: ${row.slug}.`);
            const previous = organisation.topics ?? [];
            await validateSpecificTopics(ctx, row.topics, previous);
            const sameTopics = equalTopics(previous, row.topics);
            if (row.expectedTopics !== undefined && !equalTopics(previous, row.expectedTopics))
                throw new Error(`Organisation topics changed: ${row.slug}.`);
            if (row.expectedTopics === undefined && previous.length && !sameTopics)
                throw new Error(`Existing topics differ: ${row.slug}.`);
            const isUnchanged = sameTopics && organisation.kind === row.kind;
            if (isUnchanged) result.unchanged++;
            else {
                if (args.apply)
                    await ctx.db.patch(organisation._id, {
                        kind: row.kind,
                        topics: row.topics,
                        updatedAt: Date.now(),
                    });
                result.updated++;
            }
        }

        return result;
    },
});

/** Compare assignments as distinct sets without treating their display order as a change. */
function equalTopics(previous: string[], topics: string[]) {
    return (
        new Set(topics).size === topics.length &&
        previous.length === topics.length &&
        previous.every((slug) => topics.includes(slug))
    );
}

/** Require finite coordinates inside the Swiss geographic bounding box. */
function isSwissAddress(address: Pick<Doc<"addresses">, "countryCode" | "latitude" | "longitude">) {
    const { latitude, longitude } = address;

    return (
        address.countryCode === "CH" &&
        latitude !== undefined &&
        longitude !== undefined &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= 45.8 &&
        latitude <= 47.9 &&
        longitude >= 5.9 &&
        longitude <= 10.6
    );
}

/** Compare full addresses without conflating postal codes or secondary address lines. */
function addressKey(
    address: Pick<Doc<"addresses">, "line1" | "line2" | "locality" | "postalCode" | "countryCode">,
) {
    return JSON.stringify(
        [
            address.countryCode,
            address.postalCode ?? "",
            address.locality,
            address.line1,
            address.line2 ?? "",
        ].map((value) =>
            value
                .normalize("NFKD")
                .replace(/\p{M}/gu, "")
                .trim()
                .replace(/\s+/g, " ")
                .toLowerCase(),
        ),
    );
}

/** Add verified organisation social links without replacing existing destinations. */
export const enrich = internalMutation({
    args: {
        apply: v.boolean(),
        organisations: v.array(
            v.object({
                slug: v.string(),
                website: v.string(),
                socials: socialLinks,
                sources: v.array(v.string()),
            }),
        ),
    },
    handler: async (ctx, args) => {
        // bound the reviewed batch and reject duplicate entries
        if (!args.organisations.length || args.organisations.length > 100)
            throw new Error("Enrich between 1 and 100 reviewed organisations.");
        const slugs = new Set<string>();
        const result = { applied: args.apply, added: 0, unchanged: 0 };
        for (const row of args.organisations) {
            if (slugs.has(row.slug) || !row.sources.length)
                throw new Error(`Repeated organisation or missing sources: ${row.slug}.`);
            slugs.add(row.slug);
            for (const source of row.sources) normalizeUrl(source);

            // require the reviewed organisation identity to still match production
            const organisation = await ctx.db
                .query("organisations")
                .withIndex("by_slug", (q) => q.eq("slug", row.slug))
                .unique();
            if (!organisation || domain(organisation.website) !== domain(row.website))
                throw new Error(`Organisation identity changed: ${row.slug}.`);
            const existing = await ctx.db
                .query("links")
                .withIndex("by_owner", (q) => q.eq("ownerId", organisation._id))
                .collect();

            // retain existing links and fail explicitly on conflicting curation
            for (const { position, kind, url } of reviewedSocials(row.socials)) {
                const matches = existing.filter((link) => link.kind === kind);
                if (matches.length) {
                    if (
                        matches.length !== 1 ||
                        matches[0]!.visibility !== "public" ||
                        socialUrl(matches[0]!.url, kind) !== url
                    )
                        throw new Error(`Existing ${kind} link differs: ${row.slug}.`);
                    result.unchanged++;
                } else {
                    if (args.apply)
                        await ctx.db.insert("links", {
                            ownerId: organisation._id,
                            kind,
                            url,
                            position,
                            visibility: "public",
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                        });
                    result.added++;
                }
            }
        }

        return result;
    },
});

/** Attach reviewed, hosted map logos without overwriting existing branding. */
export const logos = internalMutation({
    args: {
        apply: v.boolean(),
        organisations: v.array(
            v.object({
                slug: v.string(),
                website: v.string(),
                mapLogoUrl: v.string(),
                source: v.string(),
            }),
        ),
    },
    handler: async (ctx, args) => {
        // require a bounded batch with individually reviewed identities and assets
        if (!args.organisations.length || args.organisations.length > 100)
            throw new Error("Attach between 1 and 100 reviewed logos.");
        const slugs = new Set<string>();
        for (const row of args.organisations) {
            if (slugs.has(row.slug)) throw new Error(`Repeated organisation: ${row.slug}.`);
            slugs.add(row.slug);
            normalizeUrl(row.source);
            hostedLogo(row.mapLogoUrl, row.slug);

            // preserve existing branding and reject stale organisation identities
            const organisation = await ctx.db
                .query("organisations")
                .withIndex("by_slug", (q) => q.eq("slug", row.slug))
                .unique();
            if (!organisation || domain(organisation.website) !== domain(row.website))
                throw new Error(`Organisation identity changed: ${row.slug}.`);
            if (organisation.mapLogoUrl || organisation.logoUrl)
                throw new Error(`Organisation already has a logo: ${row.slug}.`);
            if (args.apply)
                await ctx.db.patch(organisation._id, {
                    mapLogoUrl: row.mapLogoUrl,
                    updatedAt: Date.now(),
                });
        }

        return { applied: args.apply, count: args.organisations.length };
    },
});

/** Require a content-addressed hosted PNG belonging to the reviewed organisation slug. */
function hostedLogo(value: string, slug: string) {
    const match =
        /^https:\/\/media\.zurich\.tech\/organisations\/([a-z0-9-]+)\/[a-f0-9]{64}\.png$/.exec(
            value,
        );
    if (!match || match[0] !== value || match[1] !== slug)
        throw new Error(`Expected a reviewed hosted logo: ${slug}.`);
}

/** Validate supplied social profiles and retain their stable display positions. */
function reviewedSocials(socials?: Infer<typeof socialLinks>) {
    return (["linkedin", "github", "x"] as const).flatMap((kind, position) => {
        const value = socials?.[kind];

        return value ? [{ kind, url: socialUrl(value, kind), position: position + 1 }] : [];
    });
}

/** Validate organisation profile destinations and canonicalise equivalent URLs. */
function socialUrl(value: string, kind: "linkedin" | "github" | "x") {
    const url = new URL(normalizeUrl(value));
    const hostname = url.hostname.replace(/^www\./, "");
    const valid =
        kind === "linkedin"
            ? (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) &&
              /^\/(company|school)\/[^/]+\/?$/.test(url.pathname)
            : kind === "github"
              ? hostname === "github.com" && /^\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
              : (hostname === "x.com" || hostname === "twitter.com") &&
                /^\/[A-Za-z0-9_]+\/?$/.test(url.pathname) &&
                !/^\/(share|intent|home|search|i|login|signup)\/?$/.test(url.pathname);
    if (!valid) throw new Error(`Invalid ${kind} organisation profile: ${value}.`);

    return `https://${kind === "linkedin" ? "www.linkedin.com" : kind === "github" ? "github.com" : "x.com"}${url.pathname.replace(/\/$/, "")}`;
}

/** Compare names without legal suffixes, punctuation or accents. */
function normalizeName(name: string) {
    return name
        .normalize("NFKD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/\b(ag|gmbh|inc|ltd|sa)\b/g, "")
        .replace(/[^a-z0-9]/g, "");
}

/** Compare canonical website hosts without the common www alias. */
function domain(website: string) {
    return new URL(normalizeUrl(website)).hostname.replace(/^www\./, "");
}
