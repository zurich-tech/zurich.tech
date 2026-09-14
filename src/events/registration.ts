import { api } from "../../convex/_generated/api";
import { publicClient } from "../auth/convex";

/** Register one event RSVP. */
export async function rsvp(args: {
    email: string;
    eventSlug: string;
    name: string;
    answers?: string[];
}) {
    return await publicClient().action(api.events.registrations.request, args);
}

/** Request confirmation for the weekly newsletter. */
export async function subscribe(email: string) {
    return await publicClient().action(api.mail.subscriptions.subscribe, { email });
}

/** Name the destination rather than confusing a registration platform with its organiser. */
export function registrationSite(url: string) {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname === "luma.com" || hostname === "lu.ma" ? "Luma" : hostname;
}
