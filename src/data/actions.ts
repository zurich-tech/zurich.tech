import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
let convex: ConvexHttpClient | undefined;

function client() {
    if (convexUrl === undefined || convexUrl.length === 0) {
        throw new Error("VITE_CONVEX_URL is not configured.");
    }

    convex ??= new ConvexHttpClient(convexUrl);
    return convex;
}

async function convexMutation<T>(reference: unknown, args: Record<string, unknown>) {
    return (await (client() as any).mutation(reference, args)) as T;
}

export async function subscribe(email: string, topic = "newsletter") {
    return await convexMutation<string>(anyApi.proposals.subscribe, { email, topic });
}

export async function requestMagicLink(email: string) {
    return await convexMutation<string>(anyApi.proposals.requestMagicLink, { email });
}

export async function proposeEvent(args: {
    capacity?: number;
    description: string;
    format: "hackathon" | "meetup" | "office_hours" | "other" | "talk" | "workshop";
    ownerEmail: string;
    startsAt?: number;
    title: string;
    venue?: string;
}) {
    return await convexMutation<string>(anyApi.proposals.proposeEvent, args);
}

export async function proposeSeries(args: {
    description: string;
    ownerEmail: string;
    title: string;
}) {
    return await convexMutation<string>(anyApi.proposals.proposeSeries, args);
}

export async function rsvp(args: { email: string; eventSlug: string; name: string }) {
    return await convexMutation<string>(anyApi.proposals.rsvp, args);
}
