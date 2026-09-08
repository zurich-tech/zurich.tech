import { ConvexHttpClient } from "convex/browser";
import { auth } from "./auth";

/** Create an isolated client so concurrent users never share authentication. */
export function publicClient() {
    const url = import.meta.env.VITE_CONVEX_URL;
    if (!url) throw new Error("VITE_CONVEX_URL is not configured.");

    return new ConvexHttpClient(url);
}

/** Create a client authenticated with the current browser account. */
export async function memberClient() {
    const result = await auth.convex.token();
    if (result.error || !result.data?.token) throw new Error("Please sign in to continue.");
    const client = publicClient();
    client.setAuth(result.data.token);

    return client;
}
