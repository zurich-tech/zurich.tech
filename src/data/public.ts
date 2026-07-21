import { query } from "@solidjs/router";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";

import { api } from "../../convex/_generated/api";

/** One public calendar row. */
export type CalendarEntry = FunctionReturnType<typeof api.public.calendar>[number];

/** One published event. */
export type PublicEvent = NonNullable<FunctionReturnType<typeof api.public.event>>;

/** One public event series. */
export type PublicSeries = NonNullable<FunctionReturnType<typeof api.public.seriesDetail>>;

/** One public member with optional profile records. */
export type PublicMember = FunctionReturnType<typeof api.public.membersList>[number] & {
    /** Events published by this member. */
    hostedEvents?: CalendarEntry[];
};

/** One news article with an optional body in list results. */
export type Article = FunctionReturnType<typeof api.public.articles>[number] & {
    /** The Markdown body returned on the article route. */
    body?: string;
};

/** One resolved public handle. */
export type PublicHandle = NonNullable<FunctionReturnType<typeof api.public.handle>>;

/** One global search result. */
export type SearchResult = FunctionReturnType<typeof api.public.search>[number];

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
let convex: ConvexHttpClient | undefined;

/** Return the shared Convex client, failing loudly when unconfigured. */
function client(): ConvexHttpClient {
    if (convexUrl === undefined || convexUrl.length === 0) {
        throw new Error("VITE_CONVEX_URL is not configured.");
    }

    convex ??= new ConvexHttpClient(convexUrl);

    return convex;
}

/** Split calendar entries into upcoming and past events. */
export function splitCalendar(entries: CalendarEntry[], now = Date.now()) {
    const upcoming = entries
        .filter((entry) => entry.startsAt >= now)
        .sort((left, right) => left.startsAt - right.startsAt);
    const past = entries
        .filter((entry) => entry.startsAt < now)
        .sort((left, right) => right.startsAt - left.startsAt);

    return { upcoming, past };
}

/** Read the public calendar. */
export const getCalendar = query(
    async () => await client().query(api.public.calendar, {}),
    "calendar",
);

/** Read one published event. */
export const getEvent = query(
    async (slug: string) => await client().query(api.public.event, { now: Date.now(), slug }),
    "event",
);

/** Read one public event series. */
export const getSeries = query(
    async (slug: string) => await client().query(api.public.seriesDetail, { slug }),
    "series-detail",
);

/** Read public member profiles. */
export const getMembers = query(
    async () => await client().query(api.public.membersList, {}),
    "members",
);

/** Read one public member profile. */
export const getMember = query(
    async (handle: string) => await client().query(api.public.member, { handle }),
    "member",
);

/** Read published news articles. */
export const getArticles = query(
    async () => await client().query(api.public.articles, {}),
    "articles",
);

/** Read one published news article. */
export const getArticle = query(
    async (slug: string) => await client().query(api.public.article, { slug }),
    "article",
);

/** Resolve one public handle. */
export const getHandle = query(
    async (handle: string) => await client().query(api.public.handle, { handle }),
    "handle",
);

/** Search public records. */
export const search = query(
    async (text: string) => await client().query(api.public.search, { now: Date.now(), text }),
    "search",
);
