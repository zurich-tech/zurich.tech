import { query } from "@solidjs/router";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

import { publicClient } from "../auth/convex";

/** One public calendar row. */
export type CalendarEntry = FunctionReturnType<typeof api.events.queries.calendar>[number];

/** One published event. */
export type PublicEvent = NonNullable<FunctionReturnType<typeof api.events.queries.event>>;

/** Read the public calendar. */
export const getCalendar = query(
    async () => await publicClient().query(api.events.queries.calendar, {}),
    "calendar",
);

/** Read one published event. */
export const getEvent = query(
    async (slug: string) =>
        await publicClient().query(api.events.queries.event, { now: Date.now(), slug }),
    "event",
);

/** Read recent approved event photographs. */
export const getGallery = query(
    async () => await publicClient().query(api.events.gallery.gallery, { now: Date.now() }),
    "gallery",
);

/** One recent event album with approved photo previews. */
export type GalleryAlbum = FunctionReturnType<typeof api.events.gallery.gallery>[number];
