import { isListed } from "../events/visibility";
import { newsDate, newsPath } from "../news/path";
import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { memberHandle, isPublicMember } from "../members/identity";
import { affiliationText } from "../members/affiliations";
import { publicJob } from "../jobs/jobs";
import { indexRecords, searchRecords, type SearchRecord } from "./ranking";

/** Public event presentation deliberately excludes all venue and booking data. */
function eventRecord(event: Doc<"events">): SearchRecord {
    return {
        label: event.title,
        href: `/events/${event.slug}`,
        kind: "Events",
        description: event.summary ?? "",
        startsAt: event.startsAt,
        detail:
            event.status === "cancelled"
                ? "Cancelled"
                : event.registration.kind === "external"
                  ? "External registration"
                  : "zurich.tech event",
    };
}

/** Export only public searchable copy; never serialize stored event documents. */
async function catalogueRecords(ctx: QueryCtx): Promise<SearchRecord[]> {
    const [events, series, speakers, topics] = await Promise.all([
        ctx.db.query("events").collect(),
        ctx.db.query("series").collect(),
        ctx.db.query("speakers").collect(),
        ctx.db.query("topics").collect(),
    ]);
    const appearances = new Map<string, string[]>();
    for (const speaker of speakers) {
        if (speaker.isRemoved) continue;
        const names = appearances.get(speaker.eventId) ?? [];
        names.push(`${speaker.name} ${affiliationText(speaker.affiliations) ?? ""}`);
        appearances.set(speaker.eventId, names);
    }
    return [
        ...events.filter(isListed).map((event) => ({
            ...eventRecord(event),
            status: event.status,
            description: [
                event.summary,
                event.description,
                ...event.topics.flatMap((slug) => [
                    slug,
                    topics.find((topic) => topic.slug === slug)?.name,
                ]),
                ...(appearances.get(event._id) ?? []),
            ]
                .filter(Boolean)
                .join(" "),
        })),
        ...series
            .filter((item) => item.status !== "proposed")
            .map((item) => ({
                label: item.name,
                description: [
                    item.description,
                    ...item.topics.flatMap((slug) => [
                        slug,
                        topics.find((topic) => topic.slug === slug)?.name,
                    ]),
                ].join(" "),
                href: `/series/${item.slug}`,
                kind: "Series",
            })),
    ];
}

/** One reactive public catalogue shared by global and collection search. */
export const catalogue = query({ args: {}, handler: catalogueRecords });

/** Search the published catalogue; private addresses and draft revisions never enter matching. */
export const search = query({
    args: {
        now: v.number(),
        text: v.string(),
        kinds: v.optional(
            v.array(
                v.union(
                    v.literal("Events"),
                    v.literal("Series"),
                    v.literal("People"),
                    v.literal("Organisations"),
                    v.literal("Jobs"),
                    v.literal("News"),
                ),
            ),
        ),
    },
    handler: async (ctx, args) => {
        const text = args.text.trim();
        if (text.length < 2) return [];
        if (text.length > 200) throw new ConvexError("Search must be at most 200 characters.");
        const includes = (kind: string) =>
            !args.kinds || args.kinds.some((value) => value === kind);
        const [catalogue, members, organisations, posts, jobs] = await Promise.all([
            includes("Events") || includes("Series") ? catalogueRecords(ctx) : [],
            includes("People")
                ? ctx.db
                      .query("members")
                      .withSearchIndex("search_text", (q) =>
                          q.search("searchText", text).eq("visibility", "public"),
                      )
                      .take(24)
                : [],
            includes("Organisations") ? ctx.db.query("organisations").collect() : [],
            includes("News") ? ctx.db.query("posts").collect() : [],
            includes("Jobs")
                ? ctx.db
                      .query("jobs")
                      .withIndex("by_status", (q) => q.eq("status", "published"))
                      .collect()
                : [],
        ]);
        const entries: SearchRecord[] = catalogue.filter((record) => includes(record.kind));

        // people remain permission-filtered and searched on demand
        for (const member of members.filter(isPublicMember)) {
            const handle = await memberHandle(ctx, member._id);
            if (handle)
                entries.push({
                    label: member.name,
                    image: member.avatarUrl,
                    description: [affiliationText(member.affiliations), member.headline, member.bio]
                        .filter(Boolean)
                        .join(" "),
                    href: `/members/${handle.name}`,
                    kind: "People",
                });
        }
        for (const item of organisations)
            entries.push({
                label: item.name,
                description: [item.headline, item.description, item.location]
                    .filter(Boolean)
                    .join(" "),
                href: `/organisations/${item.slug}`,
                kind: "Organisations",
            });
        for (const post of posts)
            if (post.published)
                entries.push({
                    label: post.published.title,
                    description: [
                        post.published.description,
                        post.published.body,
                        new Date(post.published.date ?? post.publishedAt!)
                            .toISOString()
                            .slice(0, 10),
                        post.published.category,
                        ...post.published.topics,
                    ]
                        .filter(Boolean)
                        .join(" "),
                    href: newsPath({ slug: post.slug, date: newsDate(post) }),
                    kind: "News",
                });
        for (const row of jobs) {
            const job = await publicJob(ctx, row);
            if (job.isOpen)
                entries.push({
                    label: job.title,
                    description: [
                        job.company.name,
                        ...job.locations.map(
                            (location) => `${location.locality} ${location.countryCode}`,
                        ),
                        job.summary,
                        ...job.topics,
                        ...job.skills,
                        job.description,
                    ].join(" "),
                    href: `/jobs/${job.slug}`,
                    kind: "Jobs",
                });
        }

        // use the same ranking, period matching and visible-result highlighting as the browser
        return searchRecords(
            indexRecords(entries),
            text,
            undefined,
            args.kinds?.length === 1 ? 1000 : 5,
            args.now,
        );
    },
});
