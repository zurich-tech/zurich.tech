import { ConvexHttpClient } from "convex/browser";

import { api } from "../../convex/_generated/api";

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

/** Subscribe one email address to a topic. */
export async function subscribe(email: string, topic: "events" | "newsletter" = "newsletter") {
    return await client().mutation(api.proposals.subscribe, { email, topic });
}

/** Submit one event proposal. */
export async function proposeEvent(args: {
    capacity?: number;
    description: string;
    format: "hackathon" | "meetup" | "office_hours" | "other" | "talk" | "workshop";
    ownerEmail: string;
    startsAt: number;
    title: string;
    venue?: string;
}) {
    return await client().mutation(api.proposals.proposeEvent, args);
}

/** Submit one recurring series proposal. */
export async function proposeSeries(args: {
    cadence: "biweekly" | "monthly" | "quarterly" | "weekly";
    description: string;
    ownerEmail: string;
    startsAt: number;
    title: string;
}) {
    return await client().mutation(api.proposals.proposeSeries, args);
}

/** Register one event RSVP. */
export async function rsvp(args: { email: string; eventSlug: string; name: string }) {
    return await client().mutation(api.proposals.rsvp, args);
}
