import { query } from "@solidjs/router";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

// TODO #Cleanup: replace these hand-written types and anyApi with convex/_generated
//  once a Convex deployment is configured (bunx convex dev) and codegen runs

export type CalendarEntry = {
    activation?: { deadlineAt: number; threshold: number };
    attendedCount?: number;
    cadence?: string;
    capacity?: number;
    endsAt?: number;
    eventId?: string;
    href?: string;
    id: string;
    location?: string;
    rsvpCount?: number;
    seriesNextAt?: number;
    seriesSlug?: string;
    seriesTitle?: string;
    slug: string;
    source: "event" | "external" | "manual";
    speakers?: string[];
    startsAt: number;
    status: "cancelled" | "draft" | "published";
    summary?: string;
    timezone: string;
    title: string;
};

export type PublicEvent = {
    agenda: Array<{ time: string; title: string }>;
    capacity?: number;
    endsAt?: number;
    format: string;
    id: string;
    location?: string;
    rsvpCount: number;
    seriesSlug?: string;
    slug: string;
    speakers: Array<{ name: string; title: string }>;
    startsAt: number;
    status: string;
    summary?: string;
    tags: string[];
    timezone: string;
    title: string;
    venue: {
        access?: string;
        address?: string;
        name?: string;
    };
};

export type PublicSeries = {
    cadence: string;
    entries?: CalendarEntry[];
    id: string;
    ownerHandle?: string;
    slug: string;
    subscriberCount: number;
    summary?: string;
    tags: string[];
    title: string;
};

export type PublicMember = {
    bio?: string;
    handle: string;
    headline?: string;
    hostedEvents?: CalendarEntry[];
    id: string;
    interests: string[];
    links: Array<{ href: string; label: string }>;
    name: string;
    status: string;
    visibility: string;
};

export type PublicPost = {
    body?: string[];
    date?: number;
    id: string;
    slug: string;
    summary: string;
    title: string;
};

export type PublicHandle = {
    href: string;
    summary?: string;
    title: string;
    type: "member";
};

export type CommunityStats = {
    attendees: number;
    events: number;
    members: number;
    series: number;
};

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
let convex: ConvexHttpClient | undefined;

/** Return the shared Convex client, failing loudly when unconfigured. */
function client() {
    if (convexUrl === undefined || convexUrl.length === 0) {
        throw new Error("VITE_CONVEX_URL is not configured.");
    }

    convex ??= new ConvexHttpClient(convexUrl);
    return convex;
}

/** Run one public Convex query. */
async function convexQuery<T>(reference: unknown, args: Record<string, unknown>) {
    return (await (client() as any).query(reference, args)) as T;
}

/** Split calendar entries into upcoming (soonest first) and past (latest first). */
export function splitCalendar(entries: CalendarEntry[], now = Date.now()) {
    const upcoming = entries
        .filter((entry) => entry.startsAt >= now)
        .sort((left, right) => left.startsAt - right.startsAt);
    const past = entries
        .filter((entry) => entry.startsAt < now)
        .sort((left, right) => right.startsAt - left.startsAt);

    return { upcoming, past };
}

export const getCalendar = query(
    () => convexQuery<CalendarEntry[]>(anyApi.public.calendar, {}),
    "calendar",
);

export const getStats = query(() => convexQuery<CommunityStats>(anyApi.public.stats, {}), "stats");

export const getEvent = query(
    (slug: string) => convexQuery<PublicEvent | null>(anyApi.public.event, { slug }),
    "event",
);

export const getSeriesList = query(
    () => convexQuery<PublicSeries[]>(anyApi.public.seriesList, {}),
    "series-list",
);

export const getSeries = query(
    (slug: string) => convexQuery<PublicSeries | null>(anyApi.public.seriesDetail, { slug }),
    "series-detail",
);

export const getMembers = query(
    () => convexQuery<PublicMember[]>(anyApi.public.membersList, {}),
    "members",
);

export const getMember = query(
    (handle: string) => convexQuery<PublicMember | null>(anyApi.public.member, { handle }),
    "member",
);

export const getPosts = query(
    () => convexQuery<PublicPost[]>(anyApi.public.postsList, {}),
    "posts",
);

export const getPost = query(
    (slug: string) => convexQuery<PublicPost | null>(anyApi.public.post, { slug }),
    "post",
);

export const getHandle = query(
    (handle: string) => convexQuery<PublicHandle | null>(anyApi.public.handle, { handle }),
    "handle",
);
