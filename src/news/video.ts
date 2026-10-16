/** Resolve supported hosted videos to privacy-conscious players; direct files need no embed. */
export function videoEmbed(source: string): string | undefined {
    const url = new URL(source);
    const host = url.hostname.replace(/^www\./, "");

    // accept only known provider paths and video identifiers
    if (["youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) {
        const id =
            host === "youtu.be"
                ? url.pathname.slice(1)
                : url.pathname === "/watch"
                  ? url.searchParams.get("v")
                  : /^\/(?:embed|shorts)\/([^/]+)$/.exec(url.pathname)?.[1];
        if (!id || !/^[\w-]{11}$/.test(id)) throw new Error("Enter a YouTube video URL.");

        return `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&autoplay=1`;
    }

    // preserve the unlisted-video hash without carrying source tracking parameters
    if (host === "vimeo.com" || host === "player.vimeo.com") {
        const match = /^\/(?:video\/)?(\d+)(?:\/([\da-f]+))?\/?$/.exec(url.pathname);
        if (!match) throw new Error("Enter a Vimeo video URL.");
        const embed = new URL(`https://player.vimeo.com/video/${match[1]}`);
        const hash = url.searchParams.get("h") ?? match[2];
        if (hash) embed.searchParams.set("h", hash);
        embed.searchParams.set("dnt", "1");
        embed.searchParams.set("autoplay", "1");

        return embed.href;
    }

    return undefined;
}
