import { isListed } from "./visibility";
import { photoUrls } from "./photos";
import { query } from "../_generated/server";

/** Read approved photo previews from every photographed event. */
export const gallery = query({
    args: {},
    handler: async (ctx) => {
        // consider only finished events, most recent first
        const events = await ctx.db
            .query("events")
            .withIndex("by_status_and_start", (range) => range.eq("status", "finished"))
            .order("desc")
            .collect();

        // Read independent albums concurrently while preserving the event order.
        const albums = await Promise.all(
            events.filter(isListed).map(async (event) => {
                const images = await ctx.db
                    .query("photos")
                    .withIndex("by_event_and_position", (range) => range.eq("eventId", event._id))
                    .filter((range) => range.eq(range.field("status"), "approved"))
                    .take(5);

                return {
                    title: event.title,
                    href: `/events/${event.slug}#photos`,
                    year: Number(
                        new Intl.DateTimeFormat("en", {
                            year: "numeric",
                            timeZone: "Europe/Zurich",
                        }).format(event.startsAt),
                    ),
                    images: await Promise.all(
                        images.map(async (image) => ({
                            id: image._id,
                            alt: image.alt ?? `Photo from ${event.title}`,
                            width: image.width,
                            height: image.height,
                            thumbnailUrl: (await photoUrls(ctx, image)).thumbnailUrl,
                        })),
                    ),
                };
            }),
        );

        return albums.filter((album) => album.images.length > 0);
    },
});
