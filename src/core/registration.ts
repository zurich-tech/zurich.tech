import { api } from "../../convex/_generated/api";
import { publicClient } from "./convex";

/** Register one event RSVP. */
export async function rsvp(args: {
    email: string;
    eventSlug: string;
    name: string;
    answers?: string[];
}) {
    return await publicClient().action(api.registration.rsvp, args);
}

/** Request confirmation for the weekly newsletter. */
export async function subscribe(email: string) {
    return await publicClient().action(api.registration.subscribe, { email });
}
