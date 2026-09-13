import { createResource, onMount, onCleanup, startTransition } from "solid-js";
import { useAccess } from "../auth/edit";
import { query } from "@solidjs/router";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";

import { publicClient, memberClient } from "../auth/convex";

/** One public calendar row. */
export type CalendarEntry =
    | FunctionReturnType<typeof api.events.queries.calendar>[number]
    | FunctionReturnType<typeof api.events.workspace.planning>[number];

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

/** Keep private planning entries scoped to the currently signed-in team account. */
export function usePlanning(enabled: () => boolean) {
    const access = useAccess();
    const account = access.account;
    const [planning, { refetch }] = createResource(
        () => (enabled() ? access.key() : undefined),
        async (key) => {
            const client = await memberClient();
            const entries = await client.query(api.events.workspace.planning, {});
            return { key, entries };
        },
        { initialValue: null },
    );
    const current = () =>
        enabled() && access.key() && !planning.error && planning.latest?.key === access.key()
            ? planning.latest
            : undefined;

    return {
        current,
        canEdit: access.canEvent,
        canCreate: access.canCreate,
        error: () => enabled() && !!account.user() && planning.error,
        retry: refetch,
    };
}

/** Refresh visible tentative events without replacing the page with a loading state. */
export function useConfirmationRefresh(enabled: () => boolean, refresh: () => unknown) {
    onMount(() => {
        const update = () => {
            if (enabled() && !document.hidden) void startTransition(refresh);
        };
        const timer = window.setInterval(update, 30000);
        window.addEventListener("focus", update);
        onCleanup(() => {
            window.clearInterval(timer);
            window.removeEventListener("focus", update);
        });
    });
}
