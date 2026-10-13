import { site } from "../app/site";

/** Stable short paths to the community's public accounts. */
const destinations = new Map([
    ["/discord", site.socials.discord],
    ["/linkedin", site.socials.linkedin],
    ["/github", "https://github.com/zurich-tech"],
    ["/x", site.socials.x],
    ["/twitter", site.socials.x],
]);

/** Redirect without forwarding query parameters or caching a changeable destination. */
export function socialRedirect(event: { request: Request }) {
    const path = new URL(event.request.url).pathname.replace(/\/$/, "");
    const destination = destinations.get(path);
    if (!destination) return new Response("Not found", { status: 404 });

    return new Response(null, {
        status: 302,
        headers: { Location: destination, "Cache-Control": "no-store" },
    });
}
