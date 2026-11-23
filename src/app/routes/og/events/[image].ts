import type { APIEvent } from "@solidjs/start/server";
import { api } from "../../../../../convex/_generated/api";
import { publicClient } from "../../../../auth/convex";
import { speakerGroups } from "../../../../events/sharing";
import { posterPng, posterSvg } from "../../../../server/poster";
import { imageData, portrait } from "../../../../server/portraits";

/** Generate a public PNG preview; drafts and unknown events never produce images. */
export async function GET(event: APIEvent) {
    const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.png$/.exec(event.params.image);
    if (!match) return new Response("Not found", { status: 404 });

    // cache one image per deployment and event, ignoring irrelevant query parameters
    const url = new URL(event.request.url);
    const cacheKey = new URL(
        `/__event-images/${import.meta.env.VITE_PUBLIC_BUILD}/${match[1]}.png`,
        url,
    );
    const cache = typeof caches === "undefined" ? undefined : await caches.open("event-images");
    const saved = await cache?.match(cacheKey.href);
    if (saved) return saved;
    const record = await publicClient().query(api.events.sharing.image, { slug: match[1] });
    if (!record) return new Response("Not found", { status: 404 });

    // load trusted fonts and map from this deployment, independently of optional remote portraits
    const asset = async (path: string) => {
        const request = new Request(new URL(path, url));
        const cloudflare = event.nativeEvent.context._platform?.cloudflare;
        const response = cloudflare
            ? await cloudflare.env.ASSETS.fetch(request)
            : await fetch(request);
        if (!response.ok) throw new Error(`could not load sharing asset: ${path}`);

        return response.arrayBuffer();
    };
    const [regular, bold, heading, map, logo] = await Promise.all([
        asset("/branding/fonts/Archivo-Regular.ttf"),
        asset("/branding/fonts/Archivo-SemiBold.ttf"),
        asset("/branding/fonts/JetBrainsMono-ExtraBold.ttf"),
        asset("/branding/events.png"),
        asset("/branding/logo.png"),
    ]);
    const groups = speakerGroups(record);
    const shown = groups.length <= 3 ? groups.flatMap((group) => group.slice(0, 2)) : [];
    const urls = [
        ...new Set(shown.flatMap((speaker) => (speaker.imageUrl ? [speaker.imageUrl] : []))),
    ];
    const portraits = new Map<string, string>();
    await Promise.all(
        urls.map(async (url) => {
            const image = await portrait(url);
            if (image) portraits.set(url, image);
        }),
    );
    const svg = posterSvg(
        record,
        {
            regular,
            bold,
            heading,
            map: imageData(new Uint8Array(map), "image/png"),
            logo: imageData(new Uint8Array(logo), "image/png"),
        },
        portraits,
    );
    const bytes = await posterPng(svg);
    const response = new Response(bytes, {
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    });
    const store = cache?.put(cacheKey.href, response.clone());
    if (store && event.nativeEvent?.context.waitUntil) event.nativeEvent.context.waitUntil(store);
    else await store;

    return response;
}
