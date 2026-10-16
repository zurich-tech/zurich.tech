import { query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { publicJob } from "../jobs/jobs";
import { newsDate, newsPath } from "../../src/news/path";

import { activeSponsors } from "../sponsorships/organisations";
import { readCatalogue } from "../organisations/catalogue";

/** Read small public news and vacancy previews only for the opened map address. */
export const activity = query({
    args: { slugs: v.array(v.string()), combined: v.optional(v.boolean()) },
    handler: async (ctx, { slugs, combined }) => {
        if (slugs.length > 256) throw new ConvexError("Select one map address at a time.");
        if (!slugs.length) return [];

        // resolve identities once and scan the two small publication catalogues once per address
        const organisations = await Promise.all(
            [...new Set(slugs)].map((slug) =>
                ctx.db
                    .query("organisations")
                    .withIndex("by_slug", (q) => q.eq("slug", slug))
                    .unique(),
            ),
        );
        const ids = new Set(
            organisations.flatMap((organisation) => (organisation ? [organisation._id] : [])),
        );
        const [posts, vacancies] = await Promise.all([
            ctx.db.query("posts").collect(),
            ctx.db
                .query("jobs")
                .withIndex("by_status", (q) => q.eq("status", "published"))
                .collect(),
        ]);

        // use the job board's payment, confirmation and deadline rules, never draft fields
        const jobs = (
            await Promise.all(
                vacancies
                    .filter((job) => ids.has(job.organisationId))
                    .map((job) => publicJob(ctx, job)),
            )
        )
            .filter((job) => job.isOpen)
            .sort((a, b) => b.publishedAt - a.publishedAt || a.slug.localeCompare(b.slug));
        const news = posts
            .filter((post) => post.published)
            .sort(
                (a, b) =>
                    (b.published!.date ?? b.publishedAt!) - (a.published!.date ?? a.publishedAt!) ||
                    a.slug.localeCompare(b.slug),
            );

        // combine before limiting so shared previews have exact totals and no repeated stories
        const existing = organisations.filter((organisation) => organisation !== null);
        const groups = combined ? [existing] : existing.map((organisation) => [organisation]);
        return groups
            .filter((group) => group.length > 0)
            .map((group) => {
                const groupIds = new Set(group.map((organisation) => organisation._id));
                const stories = news.filter((post) =>
                    post.published!.organisations.some((id) => groupIds.has(id)),
                );
                const roles = jobs.filter((job) => groupIds.has(job.company._id));

                return {
                    slug: combined ? null : group[0].slug,
                    newsCount: stories.length,
                    news: stories.slice(0, 2).map((post) => ({
                        title: post.published!.title,
                        date: post.published!.date ?? post.publishedAt!,
                        image: post.published!.image,
                        path: newsPath({ slug: post.slug, date: newsDate(post) }),
                        ...(combined
                            ? {
                                  organisation: group
                                      .filter((entry) =>
                                          post.published!.organisations.includes(entry._id),
                                      )
                                      .map((entry) => entry.name)
                                      .join(", "),
                              }
                            : {}),
                    })),
                    jobCount: roles.length,
                    jobs: roles.slice(0, 2).map((job) => ({
                        title: job.title,
                        path: `/jobs/${job.slug}`,
                        locations: job.locations,
                        workplace: job.workplace,
                        ...(combined ? { organisation: job.company.name } : {}),
                    })),
                };
            });
    },
});

/** Every public organisation location, with hosts and current sponsors highlighted. */
export const map = query({
    args: {},
    handler: async (ctx) => {
        const [sponsors, catalogue] = await Promise.all([activeSponsors(ctx), readCatalogue(ctx)]);
        const organisations = new Map(catalogue.organisations.map((row) => [String(row._id), row]));
        const sponsorsByOrganisation = new Map(
            sponsors.map((row) => [String(row.organisationId), row]),
        );
        const markers = catalogue.locations.map((location) => {
            const sponsor = sponsorsByOrganisation.get(location.ownerId);
            const organisation = organisations.get(location.ownerId);
            const address = catalogue.addressesById.get(location.addressId);
            if (!organisation || address?.latitude === undefined || address.longitude === undefined)
                return null;
            const socials = catalogue.profilesByOwner.get(organisation._id)?.socials ?? {};

            return {
                id: organisation._id,
                address: {
                    line1: address.line1,
                    postalCode: address.postalCode,
                    locality: address.locality,
                    countryCode: address.countryCode,
                },
                name: organisation.name,
                kind: organisation.kind,
                topics: organisation.topics ?? [],
                location: location.name,
                slug: organisation.slug,
                website: organisation.website,
                socials,
                logoUrl: organisation.logoUrl,
                logoDarkUrl: organisation.logoDarkUrl,
                mapLogoUrl: organisation.mapLogoUrl,
                mapLogoDarkUrl: organisation.mapLogoDarkUrl,
                latitude: address.latitude,
                longitude: address.longitude,
                isSponsor: Boolean(sponsor),
                recognition: sponsor
                    ? `${sponsor.tier[0].toUpperCase()}${sponsor.tier.slice(1)} sponsor`
                    : organisation.isHost
                      ? "Host"
                      : undefined,
                headline: organisation.headline,
                prominence:
                    organisation.isHost || sponsor?.tier === "gold"
                        ? ("large" as const)
                        : sponsor?.tier === "silver"
                          ? ("medium" as const)
                          : ("small" as const),
            };
        });
        return markers.filter((marker) => marker !== null);
    },
});
