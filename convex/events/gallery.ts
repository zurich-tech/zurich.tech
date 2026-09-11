import { v } from "convex/values";
import { query } from "../_generated/server";

/** Public origin for approved event images. */
export const mediaOrigin = "https://media.zurich.tech";

/** Read approved photo previews from every photographed event. */
export const gallery = query({
    args: { now: v.number() },
    handler: async (ctx, args) => {
        // consider only finished events, most recent first
        const events = await ctx.db
            .query("events")
            .withIndex("by_status_and_start", (range) =>
                range.eq("status", "finished").lt("startsAt", args.now),
            )
            .order("desc")
            .collect();
        const albums = [];

        // group up to five photographs under each event destination
        for (const event of events) {
            const images = await ctx.db
                .query("photos")
                .withIndex("by_event_and_position", (range) => range.eq("eventId", event._id))
                .filter((range) => range.eq(range.field("status"), "approved"))
                .take(5);
            if (images.length > 0) {
                albums.push({
                    title: event.title,
                    href: `/events/${event.slug}#photos`,
                    year: Number(
                        new Intl.DateTimeFormat("en", {
                            year: "numeric",
                            timeZone: "Europe/Zurich",
                        }).format(event.startsAt),
                    ),
                    images: images.map((image) => ({
                        id: image._id,
                        alt: image.alt ?? `Photo from ${event.title}`,
                        width: image.width,
                        height: image.height,
                        thumbnailUrl: `${mediaOrigin}/${image.thumbnailKey}`,
                    })),
                });
            }
        }

        return albums;
    },
});
