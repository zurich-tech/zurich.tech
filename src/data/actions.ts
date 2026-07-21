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
    return await client().mutation(api.registration.subscribe, { email, topic });
}

/** Register one event RSVP. */
export async function rsvp(args: { email: string; eventSlug: string; name: string }) {
    return await client().mutation(api.registration.rsvp, args);
}
