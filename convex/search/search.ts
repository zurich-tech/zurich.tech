import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { articles } from "../../src/news/articles.generated";
import { memberHandle } from "../members/queries";

/** Maximum event results in the command menu. */
const eventSearchLimit = 6;

/** Maximum search input length in characters. */
const maximumSearchLength = 200;

/** Supported temporal event filters. */
type EventPeriod = "past" | "upcoming";

/** Search words with temporal filters removed. */
type EventQuery = {
    /** Empty or contradictory filters cannot match events. */
    isImpossible: boolean;
    /** Optional restriction relative to the requested instant. */
    period?: EventPeriod;
    /** Remaining words to match against event copy. */
    text: string;
};

/** Search published public records. */
export const search = query({
    args: { now: v.number(), text: v.string() },
    handler: async (ctx, args) => {
        const text = args.text.trim();

        // reject empty and oversized searches
        if (text.length < 2) {
            return [];
        }
        if (text.length > maximumSearchLength) {
            throw new Error(`Search must be at most ${maximumSearchLength} characters.`);
        }

        const eventsQuery = eventQuery(text);
        const isEventFilter = eventsQuery.period !== undefined || eventsQuery.isImpossible;

        // search each public noun independently
        const [events, members, news] = await Promise.all([
            searchEvents(ctx, eventsQuery, args.now),
            isEventFilter
                ? Promise.resolve([])
                : ctx.db
                      .query("members")
                      .withSearchIndex("search_text", (query) =>
                          query
                              .search("searchText", text)
                              .eq("status", "active")
                              .eq("visibility", "public"),
                      )
                      .take(6),
            Promise.resolve(
                isEventFilter
                    ? []
                    : articles
                          .filter((article) =>
                              [
                                  article.title,
                                  article.description,
                                  ...article.tags.map((tag) => tag.name),
                                  ...article.authors.map((author) => author.name),
                              ]
                                  .join(" ")
                                  .toLowerCase()
                                  .includes(text.toLowerCase()),
                          )
                          .slice(0, 4),
            ),
        ]);

        // resolve member handles in result order
        const memberResults = await Promise.all(
            members.map(async (member) => {
                const handle = await memberHandle(ctx, member._id);
                if (handle === null) {
                    throw new Error(`Public member ${member._id} has no active handle.`);
                }

                return {
                    description: member.headline,
                    href: `/members/${handle.name}`,
                    kind: "member" as const,
                    label: member.name,
                };
            }),
        );

        return [
            ...events.map((event) => ({
                description: eventSearchDescription(event, args.now),
                href: `/events/${event.slug}`,
                kind: "event" as const,
                label: event.title,
            })),
            ...memberResults,
            ...news.map((article) => ({
                description: article.description,
                href: `/news/${article.slug}`,
                kind: "article" as const,
                label: article.title,
            })),
        ];
    },
});

/** Add the requested period to stable event tags. */
export function eventTags(
    tags: Array<string | undefined>,
    startsAt: number,
    now: number,
): string[] {
    const period = startsAt >= now ? "upcoming" : "past";
    const defined = tags.filter((tag): tag is string => tag !== undefined);

    return [...new Set([period, ...defined])];
}

/** Parse temporal event tags out of free-form search text. */
function eventQuery(text: string): EventQuery {
    const terms = [
        ...new Set(
            text
                .toLowerCase()
                .split(/\s+/)
                .map((term) => term.replace(/^#+/, ""))
                .filter(Boolean),
        ),
    ];
    const isUpcoming = terms.includes("upcoming");
    const isPast = terms.includes("past");
    const indexed = terms.filter((term) => term !== "upcoming" && term !== "past");
    let period: EventPeriod | undefined;

    // upcoming filter
    if (isUpcoming) {
        period = "upcoming";
    }
    // past filter
    else if (isPast) {
        period = "past";
    }

    return {
        isImpossible: (isUpcoming && isPast) || terms.length === 0,
        period,
        text: indexed.join(" "),
    };
}

/** Search public calendar entries with optional temporal filtering. */
async function searchEvents(
    ctx: QueryCtx,
    query: EventQuery,
    now: number,
): Promise<Doc<"events">[]> {
    if (query.isImpossible) return [];
    const events = await ctx.db.query("events").collect();
    const terms = query.text.toLowerCase().split(/\s+/).filter(Boolean);

    // filter the small public catalogue without maintaining a second event index
    return events
        .filter((event) => {
            const text = [
                event.title,
                event.summary,
                event.description,
                event.location,
                ...event.topics,
            ]
                .join(" ")
                .toLowerCase();

            return (
                event.status !== "draft" &&
                terms.every((term) => text.includes(term)) &&
                (query.period === undefined ||
                    (event.startsAt >= now ? "upcoming" : "past") === query.period)
            );
        })
        .sort((left, right) =>
            query.period === "past"
                ? right.startsAt - left.startsAt
                : left.startsAt - right.startsAt,
        )
        .slice(0, eventSearchLimit);
}

/** Describe one event search result with its searchable tags. */
function eventSearchDescription(entry: Doc<"events">, now: number): string {
    const tags = eventTags(entry.topics, entry.startsAt, now).map((tag) => `#${tag}`);

    return [...tags, entry.summary].filter(Boolean).join(" ");
}
