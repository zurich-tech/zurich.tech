import { createMiddleware } from "@solidjs/start/middleware";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { newsRedirect } from "./news";
import { cachedPublic } from "../data/cache";

/** Read only the public path projection, without auth or article expansion. */
const canonical = makeFunctionReference<"query", { slug: string }, string | null>(
    "news/routes:canonical",
);

export default createMiddleware({
    onRequest: (event) =>
        newsRedirect(event.request, async (slug) => {
            const url = import.meta.env.VITE_CONVEX_URL;
            if (!url) throw new Error("VITE_CONVEX_URL is not configured.");
            const client = new ConvexHttpClient(url);

            return cachedPublic(
                `${url}:news/routes:canonical:${JSON.stringify({ slug })}`,
                () => client.query(canonical, { slug }),
                event,
            );
        }),
});
