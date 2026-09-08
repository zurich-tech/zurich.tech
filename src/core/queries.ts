import { query } from "@solidjs/router";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { articles } from "../../shared/news.generated";
import { publicClient } from "./convex";

/** One public calendar row. */
export type CalendarEntry = FunctionReturnType<typeof api.public.calendar>[number];

/** One published event. */
export type PublicEvent = NonNullable<FunctionReturnType<typeof api.public.event>>;

/** One public member with optional profile records. */
export type PublicMember = FunctionReturnType<typeof api.public.membersList>[number] & {
    /** Events published by this member. */
    hostedEvents?: CalendarEntry[];
    /** Whether the member publicly identifies as a current patron. */
    isPatron?: boolean;
};

/** One resolved public handle. */
export type PublicHandle = NonNullable<FunctionReturnType<typeof api.public.handle>>;

/** One article compiled from authored Markdown. */
export type Article = (typeof articles)[number];

/** Public job fields. */
export type Job = FunctionReturnType<typeof api.jobs.list>[number];

/** One global search result. */
export type SearchResult = FunctionReturnType<typeof api.public.search>[number];

/** Read the public calendar. */
export const getCalendar = query(
    async () => await publicClient().query(api.public.calendar, {}),
    "calendar",
);

/** Read one published event. */
export const getEvent = query(
    async (slug: string) => await publicClient().query(api.public.event, { now: Date.now(), slug }),
    "event",
);

/** Read public member profiles. */
export const getMembers = query(
    async () => await publicClient().query(api.public.membersList, {}),
    "members",
);

/** Read one public member profile. */
export const getMember = query(
    async (handle: string) => await publicClient().query(api.public.member, { handle }),
    "member",
);

/** Resolve one public handle. */
export const getHandle = query(
    async (handle: string) => await publicClient().query(api.public.handle, { handle }),
    "handle",
);

/** Read published news articles. */
export const getArticles = query(async () => articles, "articles");

/** Read one published news article. */
export const getArticle = query(
    async (slug: string) => articles.find((article) => article.slug === slug) ?? null,
    "article",
);

/** Read the public organisation and series catalogue. */
export const getDirectory = query(
    async () => await publicClient().query(api.public.directory, {}),
    "directory",
);

/** Approved public vacancies. */
export const getJobs = query(async () => await publicClient().query(api.jobs.list, {}), "jobs");

/** An approved public vacancy. */
export const getJob = query(
    async (slug: string) => await publicClient().query(api.jobs.detail, { slug }),
    "job",
);

/** Active patrons who opted into the sponsor wall. */
export const getPatrons = query(
    async () => await publicClient().query(api.patrons.list, {}),
    "patrons",
);

/** Active public sponsors. */
export const getSponsors = query(
    async () => await publicClient().query(api.sponsors.list, {}),
    "sponsors",
);

/** Search public records. */
export const search = query(
    async (text: string) =>
        await publicClient().query(api.public.search, { now: Date.now(), text }),
    "search",
);
